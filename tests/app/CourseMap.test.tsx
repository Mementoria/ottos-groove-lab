import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseMap } from '../../src/app/CourseMap';
import type { Lesson } from '../../src/lessons/types';
import { layer, program, sound } from '../../src/program/build';

const LESSON: Lesson = {
  id: 'a',
  module: 0,
  title: 'Lesson a',
  unlocks: [],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'a-only',
      label: 'Only',
      type: 'guided',
      say: ['Hi'],
      check: { kind: 'playing' },
      hints: [{ say: 'a' }, { say: 'b' }],
      solution: program(null, layer(sound('bd'))),
      success: 'Yay',
    },
  ],
};

async function openDialog(): Promise<{ user: ReturnType<typeof userEvent.setup> }> {
  const user = userEvent.setup();
  render(<CourseMap lessons={[LESSON]} onOpen={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Reset progress' }));
  return { user };
}

describe('CourseMap reset dialog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts on "Keep my progress" and keeps Tab and Shift+Tab inside the dialog', async () => {
    const { user } = await openDialog();
    const dialog = screen.getByRole('dialog', { name: /Reset all progress/ });
    const keep = within(dialog).getByRole('button', { name: 'Keep my progress' });
    const reset = within(dialog).getByRole('button', { name: 'Reset' });
    expect(keep).toHaveFocus();

    await user.tab();
    expect(reset).toHaveFocus();
    await user.tab();
    expect(keep).toHaveFocus();
    await user.tab({ shift: true });
    expect(reset).toHaveFocus();
    await user.tab({ shift: true });
    expect(keep).toHaveFocus();
  });

  it('makes the map behind the dialog inert while it is open', async () => {
    const { user } = await openDialog();
    const mapButton = screen.getByRole('button', { name: /Lesson a/ });
    expect(mapButton.closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Keep my progress' }));
    expect(mapButton.closest('[inert]')).toBeNull();
  });

  it('closes on Escape even when focus has left the dialog, and returns focus', async () => {
    const { user } = await openDialog();
    act(() => {
      screen.getByRole('button', { name: 'Keep my progress' }).blur();
    });
    expect(document.body).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset progress' })).toHaveFocus();
  });
});
