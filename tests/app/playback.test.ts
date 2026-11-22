import { createPlayback } from '../../src/app/playback';
import type { AudioEngine, EvalInfo } from '../../src/audio/engine';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const evaluated: EvalInfo = { pattern: { queryArc: () => [] }, miniLocations: [] };

/**
 * A shared engine whose evaluations can be held open, recording every call in order. Code in
 * `failing` doesn't evaluate: it returns null and starts nothing.
 */
function sharedEngine(failing: ReadonlySet<string> = new Set()): {
  engine: AudioEngine;
  calls: string[];
  hold: (code: string) => Deferred<null>;
} {
  let playing = false;
  const calls: string[] = [];
  const held = new Map<string, Deferred<null>>();
  const evaluate = async (kind: string, code: string): Promise<EvalInfo | null> => {
    calls.push(`${kind}:${code}`);
    const gate = held.get(code);
    if (gate) await gate.promise;
    calls.push(`done:${code}`);
    if (failing.has(code)) return null;
    if (kind === 'play') playing = true;
    return evaluated;
  };
  const engine: AudioEngine = {
    status: () => 'ready',
    onStatus: () => () => {},
    start: () => Promise.resolve(),
    wake: () => Promise.resolve(),
    play: (code) => evaluate('play', code),
    update: (code) => evaluate('update', code),
    stop: () => {
      calls.push('stop');
      playing = false;
    },
    evalError: () => null,
    isPlaying: () => playing,
    cyclePosition: () => 0,
    analyser: () => null,
  };
  return {
    engine,
    calls,
    hold: (code) => {
      const d = deferred<null>();
      held.set(code, d);
      return d;
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe('createPlayback across sessions sharing one engine', () => {
  it("does not let a detached session's late evaluation stop its successor", async () => {
    const { engine, calls, hold } = sharedEngine();
    const gate = hold('old');
    const oldSession = createPlayback(engine, () => {});
    oldSession.play('old');
    await flush();

    oldSession.dispose();
    const newSession = createPlayback(engine, () => {});
    newSession.play('new');
    await flush();
    // The new play waits for the old evaluation instead of racing it.
    expect(calls).not.toContain('play:new');

    gate.resolve(null);
    await flush();

    // Old finishes and re-applies its stop before the new play runs, so the new one wins.
    expect(calls.slice(calls.indexOf('done:old'))).toEqual([
      'done:old',
      'stop',
      'play:new',
      'done:new',
    ]);
    expect(engine.isPlaying()).toBe(true);
  });

  it('drops work a detached session still had queued', async () => {
    const { engine, calls, hold } = sharedEngine();
    const gate = hold('a1');
    const session = createPlayback(engine, () => {});
    session.play('a1');
    await flush();
    session.update('a2');

    session.dispose();
    gate.resolve(null);
    await flush();

    expect(calls).not.toContain('update:a2');
    expect(calls).not.toContain('play:a2');
  });

  it('reports nothing after dispose', async () => {
    const { engine, hold } = sharedEngine();
    const gate = hold('x');
    const settled = vi.fn();
    const session = createPlayback(engine, settled);
    session.play('x');
    await flush();

    session.dispose();
    gate.resolve(null);
    await flush();

    expect(settled).not.toHaveBeenCalled();
  });
});

describe('createPlayback: a pending Play', () => {
  it('carries into the edit queued behind a Play that failed', async () => {
    const { engine, calls, hold } = sharedEngine(new Set(['broken']));
    const gate = hold('broken');
    const playback = createPlayback(engine, () => {});
    playback.play('broken');
    await flush();
    playback.update('fixed');

    gate.resolve(null);
    await flush();

    expect(calls).toContain('play:fixed');
    expect(engine.isPlaying()).toBe(true);
    expect(playback.wantsPlaying()).toBe(true);
  });

  it('is still cancelled by Stop', async () => {
    const { engine, calls, hold } = sharedEngine(new Set(['broken']));
    const gate = hold('broken');
    const playback = createPlayback(engine, () => {});
    playback.play('broken');
    await flush();
    playback.update('fixed');
    playback.stop();

    gate.resolve(null);
    await flush();

    expect(calls).toContain('update:fixed');
    expect(calls).not.toContain('play:fixed');
    expect(engine.isPlaying()).toBe(false);
    expect(playback.wantsPlaying()).toBe(false);
  });

  it('is not needed once sound is playing: later edits stay plain updates', async () => {
    const { engine, calls, hold } = sharedEngine(new Set(['broken']));
    const playback = createPlayback(engine, () => {});
    playback.play('a');
    await flush();
    const gate = hold('broken');
    playback.update('broken');
    await flush();
    playback.update('fixed');

    gate.resolve(null);
    await flush();

    expect(calls).toContain('update:fixed');
    expect(calls).not.toContain('play:fixed');
    expect(engine.isPlaying()).toBe(true);
  });
});
