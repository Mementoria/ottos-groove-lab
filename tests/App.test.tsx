import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { loadState, saveState } from '../src/app/storage';
import type { AudioEngine } from '../src/audio/engine';
import type { Lesson, Step } from '../src/lessons/types';
import { layer, program, sound } from '../src/program/build';

function fakeEngine(start: () => Promise<void> = () => Promise.resolve()): AudioEngine {
  return {
    status: () => 'ready',
    onStatus: () => () => {},
    start,
    play: () => Promise.resolve(null),
    update: () => Promise.resolve(null),
    stop: () => {},
    isPlaying: () => false,
    cyclePosition: () => 0,
    analyser: () => null,
  };
}

const STEP: Step = {
  id: 'only',
  label: 'Only',
  type: 'guided',
  say: ['Hi'],
  check: { kind: 'playing' },
  hints: [{ say: 'a' }, { say: 'b' }],
  solution: program(null, layer(sound('bd'))),
  success: 'Yay',
};

function lesson(id: string, module: Lesson['module']): Lesson {
  return {
    id,
    module,
    title: `Lesson ${id}`,
    unlocks: [],
    codePane: 'collapsed',
    spectrum: false,
    steps: [{ ...STEP, id: `${id}-only` }],
  };
}

const COURSE = [lesson('a', 0), lesson('b', 0), lesson('c', 'acid')];

async function wake(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Click to wake Otto' }));
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the app title and a sleeping Otto to wake', () => {
    render(<App engine={fakeEngine()} />);
    expect(screen.getByText("Otto's Groove Lab")).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Otto the octopus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Click to wake Otto' })).toBeInTheDocument();
  });

  it('starts audio on the wake click and opens the course map', async () => {
    const user = userEvent.setup();
    const start = vi.fn(() => Promise.resolve());
    render(<App engine={fakeEngine(start)} lessons={[]} />);
    await wake(user);
    expect(start).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Lessons coming soon')).toBeInTheDocument();
  });

  it('groups lessons by module and locks each until the one before is done', async () => {
    const user = userEvent.setup();
    saveState({
      version: 1,
      lessonProgress: { a: { stepIndex: 0, completed: true } },
      workspaces: {},
    });
    render(<App engine={fakeEngine()} lessons={COURSE} />);
    await wake(user);

    const module0 = await screen.findByRole('region', { name: /Module 0/ });
    expect(within(module0).getByRole('button', { name: /Lesson a/ })).toBeEnabled();
    expect(within(module0).getByRole('button', { name: /Lesson b/ })).toBeEnabled();
    const studio = screen.getByRole('region', { name: 'Song Studio' });
    expect(within(studio).getByRole('button', { name: /Lesson c/ })).toBeDisabled();
  });

  it('resets progress only after confirming in the dialog', async () => {
    const user = userEvent.setup();
    saveState({
      version: 1,
      lessonProgress: { a: { stepIndex: 0, completed: true } },
      workspaces: {},
    });
    render(<App engine={fakeEngine()} lessons={COURSE} />);
    await wake(user);

    await user.click(await screen.findByRole('button', { name: 'Reset progress' }));
    const dialog = screen.getByRole('dialog', { name: /Reset all progress/ });
    await user.click(within(dialog).getByRole('button', { name: 'Keep my progress' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(loadState().lessonProgress['a']?.completed).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(loadState().lessonProgress).toEqual({});
    expect(screen.getByRole('button', { name: /Lesson b/ })).toBeDisabled();
  });

  it('closes the reset dialog with Escape', async () => {
    const user = userEvent.setup();
    render(<App engine={fakeEngine()} lessons={COURSE} />);
    await wake(user);
    await user.click(await screen.findByRole('button', { name: 'Reset progress' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
