import type { Pattern } from '@strudel/core';
import type * as StrudelWeb from '@strudel/web';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EvalInfo {
  pattern: Pattern;
  miniLocations: [number, number][];
}

export interface AudioEngine {
  status(): EngineStatus;
  onStatus(cb: (s: EngineStatus, error?: Error) => void): () => void;
  /** Call from a user gesture. Idempotent; resumes a suspended context; retries after an error. */
  start(): Promise<void>;
  /**
   * Call from a user gesture. Starts everything `start` does, but resolves as soon as audio is
   * unlocked, while the sounds keep loading (watch `status`). Never rejects.
   */
  wake(): Promise<void>;
  /** Starts audio if needed, then evaluates and plays. Resolves null on empty code or failure. */
  play(code: string): Promise<EvalInfo | null>;
  /**
   * Re-evaluates; plays only if already playing. After an init error it resolves null without
   * retrying: only `start` and `play` (user gestures) try again.
   */
  update(code: string): Promise<EvalInfo | null>;
  /**
   * Why the latest `play` or `update` could not evaluate its code (a typo in a pattern, say), or
   * null if it evaluated, was silence, or never reached evaluation. The old pattern keeps playing.
   */
  evalError(): Error | null;
  stop(): void;
  isPlaying(): boolean;
  cyclePosition(): number;
  analyser(): AnalyserNode | null;
}

/** A seam for tests; the real one wraps @strudel/web. */
export interface StrudelBackend {
  /** Fast: loads the audio module and resumes its context (needs the user gesture). */
  unlock(): Promise<void>;
  /** Slow: worklets, samples and soundfonts. Called after `unlock`. */
  init(): Promise<void>;
  /** Rejects with the evaluation error when the code won't evaluate. */
  evaluate(code: string, autoplay: boolean): Promise<EvalInfo>;
  stop(): void;
  now(): number;
  audioContext(): AudioContext;
  outputNode(): AudioNode;
}

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function createEngine(backend: StrudelBackend = createStrudelBackend()): AudioEngine {
  let status: EngineStatus = 'idle';
  let initPromise: Promise<void> | null = null;
  /** Settles once the current init attempt has unlocked audio (or failed to). */
  let unlocked: Promise<void> = Promise.resolve();
  let playing = false;
  let lastEvalError: Error | null = null;
  let analyserNode: AnalyserNode | null = null;
  let connectedTo: AudioNode | null = null;
  const listeners = new Set<(s: EngineStatus, error?: Error) => void>();

  function setStatus(next: EngineStatus, error?: Error): void {
    status = next;
    for (const listener of listeners) listener(next, error);
  }

  function ensureReady(): Promise<void> {
    if (status === 'ready') return Promise.resolve();
    if (initPromise) return initPromise;
    setStatus('loading');
    const unlocking = backend.unlock();
    unlocked = unlocking.catch(() => undefined);
    initPromise = unlocking
      .then(() => backend.init())
      .then(
        () => {
          initPromise = null;
          setStatus('ready');
        },
        (reason: unknown) => {
          initPromise = null;
          setStatus('error', toError(reason));
        },
      );
    return initPromise;
  }

  // The superdough controller can be reset, so re-check the output node on every start.
  function connectAnalyser(): void {
    const output = backend.outputNode();
    analyserNode ??= backend.audioContext().createAnalyser();
    analyserNode.fftSize = 2048;
    if (connectedTo !== output) {
      output.connect(analyserNode);
      connectedTo = output;
    }
  }

  async function start(): Promise<void> {
    await ensureReady();
    if (status !== 'ready') return;
    const context = backend.audioContext();
    if (context.state === 'suspended') await context.resume();
    connectAnalyser();
  }

  async function wake(): Promise<void> {
    const starting = start().catch((reason: unknown) => {
      console.warn('Audio could not start.', reason);
    });
    await Promise.race([unlocked, starting]);
  }

  async function evaluate(code: string, autoplay: boolean): Promise<EvalInfo | null> {
    try {
      return await backend.evaluate(code, autoplay);
    } catch (reason) {
      lastEvalError = toError(reason);
      return null;
    }
  }

  function silence(): null {
    if (playing) stop();
    return null;
  }

  function stop(): void {
    if (status === 'ready') backend.stop();
    playing = false;
  }

  async function play(code: string): Promise<EvalInfo | null> {
    lastEvalError = null;
    if (code.trim() === '') return silence();
    await start();
    if (status !== 'ready') return null;
    const result = await evaluate(code, true);
    if (result !== null) playing = true;
    return result;
  }

  async function update(code: string): Promise<EvalInfo | null> {
    lastEvalError = null;
    if (code.trim() === '') return silence();
    // Retrying here would flicker the status (and build a new repl) on every edit.
    if (status === 'error') return null;
    await ensureReady();
    if (status !== 'ready') return null;
    return evaluate(code, playing);
  }

  return {
    status: () => status,
    onStatus(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    start,
    wake,
    play,
    update,
    stop,
    evalError: () => lastEvalError,
    isPlaying: () => playing,
    cyclePosition: () => (playing ? backend.now() : 0),
    analyser: () => analyserNode,
  };
}

export function createStrudelBackend(): StrudelBackend {
  // Loaded lazily so importing the engine (e.g. in tests) never touches Web Audio.
  let web: typeof StrudelWeb | null = null;
  let repl: StrudelWeb.StrudelRepl | null = null;
  let lastLocations: [number, number][] = [];
  let lastError: unknown = null;

  function loaded(): { web: typeof StrudelWeb; repl: StrudelWeb.StrudelRepl } {
    if (!web || !repl) throw new Error('Strudel is not initialised yet');
    return { web, repl };
  }

  let pendingWeb: Promise<typeof StrudelWeb> | null = null;
  // Shared by unlock and init; a failed import is forgotten so Retry can try again.
  const loadWeb = (): Promise<typeof StrudelWeb> =>
    (pendingWeb ??= import('@strudel/web').catch((reason: unknown) => {
      pendingWeb = null;
      throw reason;
    }));

  return {
    async unlock() {
      const webModule = await loadWeb();
      await webModule.getAudioContext().resume();
    },
    async init() {
      const [webModule, soundfonts] = await Promise.all([loadWeb(), import('@strudel/soundfonts')]);
      await webModule.initAudio();
      repl = await webModule.initStrudel({
        prebake: async () => {
          await Promise.all([
            webModule.samples('github:tidalcycles/dirt-samples'),
            webModule.samples(
              'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json',
            ),
            soundfonts.registerSoundfonts(),
          ]);
        },
        afterEval: ({ meta }) => {
          lastLocations = meta?.miniLocations ?? [];
        },
        // The repl catches evaluation errors (and keeps the old pattern); this is how we hear.
        onEvalError: (error) => {
          lastError = error;
        },
      });
      web = webModule;
    },
    async evaluate(code, autoplay) {
      lastLocations = [];
      lastError = null;
      const pattern = await loaded().repl.evaluate(code, autoplay);
      if (pattern === undefined) throw lastError ?? new Error('The code could not be evaluated.');
      return { pattern, miniLocations: lastLocations };
    },
    stop: () => {
      loaded().repl.stop();
    },
    now: () => loaded().repl.scheduler.now(),
    audioContext: () => loaded().web.getAudioContext(),
    outputNode: () => loaded().web.getSuperdoughAudioController().output.destinationGain,
  };
}
