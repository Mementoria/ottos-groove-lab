import {
  createEngine,
  type EngineStatus,
  type EvalInfo,
  type StrudelBackend,
} from '../../src/audio/engine';
import type { Pattern } from '@strudel/core';

interface FakeContext {
  state: AudioContextState;
  resume: ReturnType<typeof vi.fn<() => Promise<void>>>;
  createAnalyser: () => AnalyserNode;
}

interface Fake {
  backend: StrudelBackend;
  calls: string[];
  context: FakeContext;
  unlock: ReturnType<typeof vi.fn<() => Promise<void>>>;
  init: ReturnType<typeof vi.fn<() => Promise<void>>>;
  evaluate: ReturnType<typeof vi.fn<(code: string, autoplay: boolean) => Promise<EvalInfo | null>>>;
}

const info: EvalInfo = { pattern: {} as Pattern, miniLocations: [] };

function makeFake(): Fake {
  const calls: string[] = [];
  const analyserNode = { fftSize: 0 } as AnalyserNode;
  const context: FakeContext = {
    state: 'running',
    resume: vi.fn(() => {
      calls.push('resume');
      context.state = 'running';
      return Promise.resolve();
    }),
    createAnalyser: () => analyserNode,
  };
  const unlock = vi.fn(() => {
    calls.push('unlock');
    return Promise.resolve();
  });
  const init = vi.fn(() => {
    calls.push('init');
    return Promise.resolve();
  });
  const evaluate = vi.fn((code: string, autoplay: boolean) => {
    calls.push(`evaluate:${code}:${String(autoplay)}`);
    return Promise.resolve<EvalInfo | null>(info);
  });
  const backend: StrudelBackend = {
    unlock,
    init,
    evaluate,
    stop: () => {
      calls.push('stop');
    },
    now: () => 1.5,
    audioContext: () => context as unknown as AudioContext,
    outputNode: () => ({ connect: vi.fn() }) as unknown as AudioNode,
  };
  return { backend, calls, context, unlock, init, evaluate };
}

describe('createEngine', () => {
  it('play while idle initialises first, then evaluates with autoplay, ending ready', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    expect(engine.status()).toBe('idle');
    const result = await engine.play('s("bd")');
    expect(fake.calls).toEqual(['unlock', 'init', 'evaluate:s("bd"):true']);
    expect(result).toBe(info);
    expect(engine.status()).toBe('ready');
    expect(engine.isPlaying()).toBe(true);
  });

  it('play while loading awaits the same init', async () => {
    const fake = makeFake();
    let finish: () => void = () => undefined;
    fake.init.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const engine = createEngine(fake.backend);
    const first = engine.play('a');
    const second = engine.play('b');
    expect(engine.status()).toBe('loading');
    // init starts once audio is unlocked.
    await vi.waitFor(() => {
      expect(fake.init).toHaveBeenCalled();
    });
    finish();
    await Promise.all([first, second]);
    expect(fake.init).toHaveBeenCalledTimes(1);
    expect(fake.evaluate).toHaveBeenCalledTimes(2);
  });

  it('resumes a suspended audio context before evaluating', async () => {
    const fake = makeFake();
    fake.context.state = 'suspended';
    const engine = createEngine(fake.backend);
    await engine.play('s("bd")');
    expect(fake.calls).toEqual(['unlock', 'init', 'resume', 'evaluate:s("bd"):true']);
  });

  it('reports an init failure, plays nothing, and retries on a later start', async () => {
    const fake = makeFake();
    const failure = new Error('samples offline');
    fake.init.mockRejectedValueOnce(failure);
    const engine = createEngine(fake.backend);
    const seen: { status: EngineStatus; error?: Error }[] = [];
    engine.onStatus((status, error) => {
      seen.push(error ? { status, error } : { status });
    });

    expect(await engine.play('s("bd")')).toBeNull();
    expect(engine.status()).toBe('error');
    expect(seen).toContainEqual({ status: 'error', error: failure });
    expect(fake.evaluate).not.toHaveBeenCalled();
    expect(engine.isPlaying()).toBe(false);

    await engine.start();
    expect(fake.init).toHaveBeenCalledTimes(2);
    expect(engine.status()).toBe('ready');
  });

  it('update evaluates without autoplay while stopped and with autoplay while playing', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    await engine.update('a');
    expect(fake.evaluate).toHaveBeenLastCalledWith('a', false);
    expect(engine.isPlaying()).toBe(false);
    await engine.play('b');
    await engine.update('c');
    expect(fake.evaluate).toHaveBeenLastCalledWith('c', true);
  });

  it('keeps playing state when a later play fails to evaluate', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    await engine.play('good');
    fake.evaluate.mockResolvedValueOnce(null);
    expect(await engine.play('bad(')).toBeNull();
    expect(engine.isPlaying()).toBe(true);
    expect(engine.cyclePosition()).toBe(1.5);
  });

  it('treats empty or whitespace code as silence without evaluating', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    await engine.play('s("bd")');
    expect(await engine.play('  \n ')).toBeNull();
    expect(engine.isPlaying()).toBe(false);
    expect(await engine.update('')).toBeNull();
    expect(fake.evaluate).toHaveBeenCalledTimes(1);
    expect(fake.calls).toContain('stop');
  });

  it('reports cycle position only while playing and exposes an analyser', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    expect(engine.cyclePosition()).toBe(0);
    expect(engine.analyser()).toBeNull();
    await engine.play('s("bd")');
    expect(engine.cyclePosition()).toBe(1.5);
    expect(engine.analyser()).not.toBeNull();
    engine.stop();
    expect(engine.cyclePosition()).toBe(0);
  });
});

describe('wake', () => {
  it('resolves once audio is unlocked, while the sounds keep loading', async () => {
    const fake = makeFake();
    let finish: () => void = () => undefined;
    fake.init.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const engine = createEngine(fake.backend);
    await engine.wake();
    expect(fake.unlock).toHaveBeenCalledTimes(1);
    expect(engine.status()).toBe('loading');

    finish();
    await engine.start();
    expect(engine.status()).toBe('ready');
    expect(fake.init).toHaveBeenCalledTimes(1);
  });

  it('never rejects: a failed unlock is reported as the error status', async () => {
    const fake = makeFake();
    fake.unlock.mockRejectedValueOnce(new Error('no audio'));
    const engine = createEngine(fake.backend);
    await expect(engine.wake()).resolves.toBeUndefined();
    expect(engine.status()).toBe('error');
    expect(fake.init).not.toHaveBeenCalled();
  });

  it('resolves at once when already ready', async () => {
    const fake = makeFake();
    const engine = createEngine(fake.backend);
    await engine.start();
    await engine.wake();
    expect(fake.unlock).toHaveBeenCalledTimes(1);
    expect(engine.status()).toBe('ready');
  });
});
