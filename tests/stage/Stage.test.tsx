import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stage, type StageProps } from '../../src/stage/Stage';

function makeProps(overrides: Partial<StageProps> = {}): StageProps {
  return {
    checklist: { title: 'Lesson', labels: ['A', 'B'], current: 0, completed: 0 },
    otto: { beatPhase: () => 0, level: () => 0, mood: 'idle' },
    bubble: { lines: ['Hi there'], onDone: () => {} },
    bubbleKey: 'one',
    scope: { analyser: () => null, mode: 'scope' },
    spectrumAvailable: false,
    playing: false,
    onPlay: () => {},
    onStop: () => {},
    onHint: () => {},
    hintDisabled: false,
    hasTarget: false,
    targetPlaying: false,
    onToggleTarget: () => {},
    engineError: null,
    onRetryAudio: () => {},
    ...overrides,
  };
}

describe('Stage', () => {
  beforeEach(() => {
    // jsdom has no canvas; the scope must cope with getContext returning null.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the spectrum toggle unless the spectrum is available', () => {
    const { rerender } = render(<Stage {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /spectrum/i })).not.toBeInTheDocument();
    rerender(<Stage {...makeProps({ spectrumAvailable: true })} />);
    expect(screen.getByRole('button', { name: /spectrum/i })).toBeInTheDocument();
  });

  it('switches the toggle between spectrum and scope', async () => {
    const user = userEvent.setup();
    render(<Stage {...makeProps({ spectrumAvailable: true })} />);
    await user.click(screen.getByRole('button', { name: /spectrum/i }));
    expect(screen.getByRole('button', { name: /scope/i })).toBeInTheDocument();
  });

  it('calls onPlay from the Play button and shows Stop while playing', async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(<Stage {...makeProps({ onPlay, onStop })} />);
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    rerender(<Stage {...makeProps({ onPlay, onStop, playing: true })} />);
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onHint and disables the hint button when told to', async () => {
    const user = userEvent.setup();
    const onHint = vi.fn();
    const { rerender } = render(<Stage {...makeProps({ onHint })} />);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(onHint).toHaveBeenCalledTimes(1);
    rerender(<Stage {...makeProps({ onHint, hintDisabled: true })} />);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();
  });

  it('shows the goal toggle only with a target, reflecting whether it plays', async () => {
    const user = userEvent.setup();
    const onToggleTarget = vi.fn();
    const { rerender } = render(<Stage {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /hear the goal/i })).not.toBeInTheDocument();
    rerender(<Stage {...makeProps({ hasTarget: true, onToggleTarget })} />);
    const toggle = screen.getByRole('button', { name: /hear the goal/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(onToggleTarget).toHaveBeenCalledTimes(1);
    rerender(<Stage {...makeProps({ hasTarget: true, targetPlaying: true })} />);
    expect(screen.getByRole('button', { name: /hear the goal/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows Otto’s connection message with a working Retry on engine error', async () => {
    const user = userEvent.setup();
    const onRetryAudio = vi.fn();
    render(<Stage {...makeProps({ engineError: 'boom', onRetryAudio })} />);
    expect(
      screen.getByText("I can't reach the sound library. Check your connection?"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryAudio).toHaveBeenCalledTimes(1);
  });

  it('replays identical lines when the bubble key changes', () => {
    const onDone = vi.fn();
    const bubble = { lines: ['Same'], onDone };
    const { rerender } = render(<Stage {...makeProps({ bubble, bubbleKey: 'a' })} />);
    rerender(<Stage {...makeProps({ bubble, bubbleKey: 'a' })} />);
    expect(onDone).toHaveBeenCalledTimes(1);
    rerender(<Stage {...makeProps({ bubble, bubbleKey: 'b' })} />);
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});
