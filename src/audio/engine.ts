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
  /** Starts audio if needed, then evaluates and plays. Resolves null on empty code or failure. */
  play(code: string): Promise<EvalInfo | null>;
  /** Re-evaluates; plays only if already playing. */
  update(code: string): Promise<EvalInfo | null>;
  stop(): void;
  isPlaying(): boolean;
  cyclePosition(): number;
  analyser(): AnalyserNode | null;
}

/** A seam for tests; the real one wraps @strudel/web. */
export interface StrudelBackend {
  init(): Promise<void>;
  evaluate(code: string, autoplay: boolean): Promise<EvalInfo | null>;
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
  let playing = false;
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
    initPromise = backend.init().then(
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

  function silence(): null {
    if (playing) stop();
    return null;
  }

  function stop(): void {
    if (status === 'ready') backend.stop();
    playing = false;
  }

  async function play(code: string): Promise<EvalInfo | null> {
    if (code.trim() === '') return silence();
    await start();
    if (status !== 'ready') return null;
    const result = await backend.evaluate(code, true);
    if (result !== null) playing = true;
    return result;
  }

  async function update(code: string): Promise<EvalInfo | null> {
    if (code.trim() === '') return silence();
    await ensureReady();
    if (status !== 'ready') return null;
    return backend.evaluate(code, playing);
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
    play,
    update,
    stop,
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

  function loaded(): { web: typeof StrudelWeb; repl: StrudelWeb.StrudelRepl } {
    if (!web || !repl) throw new Error('Strudel is not initialised yet');
    return { web, repl };
  }

  return {
    async init() {
      const [webModule, soundfonts] = await Promise.all([
        import('@strudel/web'),
        import('@strudel/soundfonts'),
      ]);
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
      });
      web = webModule;
    },
    async evaluate(code, autoplay) {
      lastLocations = [];
      const pattern = await loaded().repl.evaluate(code, autoplay);
      return pattern === undefined ? null : { pattern, miniLocations: lastLocations };
    },
    stop: () => {
      loaded().repl.stop();
    },
    now: () => loaded().repl.scheduler.now(),
    audioContext: () => loaded().web.getAudioContext(),
    outputNode: () => loaded().web.getSuperdoughAudioController().output.destinationGain,
  };
}
