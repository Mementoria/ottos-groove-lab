import { WAKE_TIMEOUT_MS, wakeWithin } from '../../src/app/wake';
import type { AudioEngine } from '../../src/audio/engine';

function engineWaking(wake: () => Promise<void>): AudioEngine {
  return {
    status: () => 'loading',
    onStatus: () => () => {},
    start: () => Promise.resolve(),
    wake,
    play: () => Promise.resolve(null),
    update: () => Promise.resolve(null),
    stop: () => {},
    isPlaying: () => false,
    cyclePosition: () => 0,
    analyser: () => null,
  };
}

describe('wakeWithin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves as soon as the engine is awake', async () => {
    const done = vi.fn();
    void wakeWithin(engineWaking(() => Promise.resolve())).then(done);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });

  it('gives up waiting after the timeout so a stalled load never traps the learner', async () => {
    const done = vi.fn();
    void wakeWithin(engineWaking(() => new Promise<void>(() => {}))).then(done);
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS - 1);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });

  it('resolves even if waking throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const done = vi.fn();
    void wakeWithin(engineWaking(() => Promise.reject(new Error('boom')))).then(done);
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });
});
