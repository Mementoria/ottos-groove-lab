import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { loadState, saveState } from '../src/app/storage';
import type { AudioEngine } from '../src/audio/engine';
import { course } from '../src/lessons/content';
import type { Lesson, Step } from '../src/lessons/types';
import { layer, program, sound } from '../src/program/build';

function fakeEngine(wake: () => Promise<void> = () => Promise.resolve()): AudioEngine {
  return {
    status: () => 'ready',
    onStatus: () => () => {},
    start: () => Promise.resolve(),
    wake,
    play: () => Promise.resolve(null),
    update: () => Promise.resolve(null),
    stop: () => {},
    evalError: () => null,
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

  it('wakes audio on the click and opens the course map', async () => {
    const user = userEvent.setup();
    const wakeEngine = vi.fn(() => Promise.resolve());
    render(<App engine={fakeEngine(wakeEngine)} lessons={[]} />);
    await wake(user);
    expect(wakeEngine).toHaveBeenCalledTimes(1);
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

  it('shows the eight Song Studio styles, seven of them coming soon', async () => {
    const user = userEvent.setup();
    render(<App engine={fakeEngine()} />);
    await wake(user);

    const studio = await screen.findByRole('region', { name: 'Song Studio' });
    const cards = within(studio).getAllByRole('button');
    expect(cards.map((c) => c.querySelector('.map-card-title')?.textContent)).toEqual([
      'Acid',
      'House',
      'Techno',
      'Lo-fi hip hop',
      'Ambient',
      'Classical',
      'Jazz',
      'Pop',
    ]);
    const soon = cards.filter((c) => c.textContent.includes('Coming soon'));
    expect(soon).toHaveLength(7);
    for (const card of cards) expect(card).toBeDisabled();
    expect(studio.querySelectorAll('.arm-glyph-held')).toHaveLength(8);
  });

  it('unlocks the Acid song once the Module 2 capstone is done', async () => {
    const user = userEvent.setup();
    saveState({
      version: 1,
      lessonProgress: { 'm2-acidline': { stepIndex: 0, completed: true } },
      workspaces: {},
    });
    render(<App engine={fakeEngine()} lessons={course} />);
    await wake(user);

    const studio = await screen.findByRole('region', { name: 'Song Studio' });
    expect(within(studio).getByRole('button', { name: /Acid/ })).toBeEnabled();
    expect(within(studio).getByRole('button', { name: /House/ })).toBeDisabled();
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
