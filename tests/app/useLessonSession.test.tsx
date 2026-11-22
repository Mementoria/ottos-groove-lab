import { act, renderHook } from '@testing-library/react';
import { loadState, saveState, STORAGE_KEY } from '../../src/app/storage';
import { brokenSourceIds } from '../../src/app/typos';
import { SHOW_ME_LINE, TYPO_LINE, useLessonSession } from '../../src/app/useLessonSession';
import type { AudioEngine, EvalInfo } from '../../src/audio/engine';
import type { CheckContext } from '../../src/checkers/checks';
import { IDLE_MS } from '../../src/lessons/runner';
import type { Lesson, Step } from '../../src/lessons/types';
import { highlightBus, type Highlight } from '../../src/otto/highlightBus';
import { layer, program, sound } from '../../src/program/build';
import { toStrudelCode } from '../../src/program/codegen';
import type { Program } from '../../src/program/types';

const buildContextMock = vi.hoisted(() =>
  vi.fn<(program: Program, playing: boolean) => Promise<CheckContext>>(),
);

vi.mock('../../src/checkers/checks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/checkers/checks')>();
  return { ...actual, buildContext: buildContextMock };
});

/* ---------- helpers ---------- */

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

function context(p: Program, playing: boolean): CheckContext {
  return { program: p, onsets: [], playing };
}

interface FakeEngine extends AudioEngine {
  play: ReturnType<typeof vi.fn<(code: string) => Promise<EvalInfo | null>>>;
  update: ReturnType<typeof vi.fn<(code: string) => Promise<EvalInfo | null>>>;
  stop: ReturnType<typeof vi.fn<() => void>>;
  evalError: ReturnType<typeof vi.fn<() => Error | null>>;
}

const evaluated: EvalInfo = { pattern: {} as EvalInfo['pattern'], miniLocations: [] };

/** Mirrors the real engine: play marks it playing only after its evaluation resolves. */
function fakeEngine(): FakeEngine & { setPlayDelay: (d: Deferred<null>) => void } {
  let playing = false;
  let playDelay: Deferred<null> | null = null;
  const engine = {
    status: () => 'ready' as const,
    onStatus: () => () => {},
    start: () => Promise.resolve(),
    wake: () => Promise.resolve(),
    play: vi.fn(async (code: string): Promise<EvalInfo | null> => {
      const delay = playDelay;
      playDelay = null;
      if (delay) await delay.promise;
      if (code.trim() === '') return null;
      playing = true;
      return evaluated;
    }),
    // As the real engine: plays only if already playing, and silence evaluates to nothing.
    update: vi.fn((code: string): Promise<EvalInfo | null> => {
      if (code.trim() !== '') return Promise.resolve(evaluated);
      playing = false;
      return Promise.resolve(null);
    }),
    stop: vi.fn(() => {
      playing = false;
    }),
    evalError: vi.fn<() => Error | null>(() => null),
    isPlaying: () => playing,
    cyclePosition: () => 0,
    analyser: () => null,
    setPlayDelay: (d: Deferred<null>) => {
      playDelay = d;
    },
  };
  return engine;
}

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/* ---------- fixture course ---------- */

const START = program(null, layer(sound('bd')));
const SOLUTION = program(null, layer(sound('bd')), layer(sound('hh*8')));
const TARGET = program(null, layer(sound('bd*2')), layer(sound('hh*8')));
const JAM_START = program(120, layer(sound('bd*4')));

const TWO_ARMS: Step = {
  id: 'two-arms',
  label: 'Two arms',
  type: 'puzzle',
  say: ['Add a second arm.'],
  start: START,
  check: { kind: 'layers', min: 2 },
  hints: [
    { say: 'How many arms do you have?' },
    { say: 'Grab another arm block.', highlight: { blockTypes: ['ogl_layer'] } },
  ],
  solution: SOLUTION,
  target: TARGET,
  success: 'Two arms!',
};

const JAM: Step = {
  id: 'jam',
  label: 'Jam',
  type: 'open',
  say: ['Play with it.'],
  start: JAM_START,
  check: { kind: 'manual' },
  hints: [{ say: 'Anything goes.' }, { say: 'Really.' }],
  solution: JAM_START,
  success: 'Lovely.',
};

/** The fixture lesson with other steps. */
function fixtureWith(steps: Step[]): Lesson[] {
  return [
    {
      id: 'fixture',
      module: 0,
      title: 'Fixture',
      unlocks: ['ogl_layer', 'ogl_sound'],
      codePane: 'collapsed',
      spectrum: false,
      steps,
    },
  ];
}

const course: Lesson[] = [
  ...fixtureWith([TWO_ARMS, JAM]),
  {
    id: 'second',
    module: 0,
    title: 'Second',
    unlocks: [],
    codePane: 'collapsed',
    spectrum: false,
    steps: [],
  },
];

const T0 = 1_000_000;
let clock = T0;
const now = () => clock;

function change(p: Program, state: object = { saved: true }) {
  return { program: p, warnings: [], state };
}

function setup(overrides: { engine?: FakeEngine; debounceMs?: number; course?: Lesson[] } = {}) {
  const engine = overrides.engine ?? fakeEngine();
  const lessons = overrides.course ?? course;
  const hook = renderHook(() =>
    useLessonSession(0, {
      engine,
      now,
      debounceMs: overrides.debounceMs ?? 100,
      course: lessons,
    }),
  );
  return { engine, hook };
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = T0;
  localStorage.clear();
  buildContextMock.mockReset();
  buildContextMock.mockImplementation((p, playing) => Promise.resolve(context(p, playing)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ---------- tests ---------- */

describe('useLessonSession: entering a lesson', () => {
  it('starts a fresh lesson from the first step’s start program, without a load request', () => {
    const { hook } = setup();
    expect(hook.result.current.lesson.id).toBe('fixture');
    expect(hook.result.current.initial).toEqual({ kind: 'program', program: START });
    expect(hook.result.current.loadRequest).toBeNull();
    expect(hook.result.current.runner.stepIndex).toBe(0);
    expect(hook.result.current.generated).toEqual(toStrudelCode(START));
    expect(hook.result.current.speech.lines).toEqual(['Add a second arm.']);
  });

  it('restores saved work and progress instead of the start program', () => {
    const saved = { blocks: { languageVersion: 0, blocks: [] } };
    saveState({
      version: 1,
      lessonProgress: { fixture: { stepIndex: 1, completed: false } },
      workspaces: { fixture: saved },
    });
    const { hook } = setup();
    // The saved step's start, in case the saved blocks won't load.
    expect(hook.result.current.initial).toEqual({
      kind: 'saved',
      state: saved,
      fallback: JAM_START,
    });
    expect(hook.result.current.loadRequest).toBeNull();
    expect(hook.result.current.runner.stepIndex).toBe(1);
    expect(hook.result.current.speech.lines).toEqual(['Play with it.']);
  });

  it('keeps going with fresh state when the saved data is corrupt', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, '{not json');
    const { hook } = setup();
    expect(hook.result.current.initial).toEqual({ kind: 'program', program: START });
  });

  it('computes the cumulative toolbox from the injected course', () => {
    const { hook } = setup();
    expect(hook.result.current.unlocked).toEqual(['ogl_layer', 'ogl_sound']);
  });
});

describe('useLessonSession: last edit wins (Review Focus 4)', () => {
  it('debounces rapid changes into one engine update with the latest code', async () => {
    const { engine, hook } = setup({ debounceMs: 100 });
    const first = program(null, layer(sound('bd sd')));
    const second = program(null, layer(sound('bd sd hh')));
    act(() => {
      hook.result.current.onBlocksChange(change(first));
    });
    await advance(50);
    act(() => {
      hook.result.current.onBlocksChange(change(second));
    });
    await advance(100);
    expect(engine.update).toHaveBeenCalledTimes(1);
    expect(engine.update).toHaveBeenCalledWith(toStrudelCode(second).code);
    await advance(500);
    expect(engine.update).toHaveBeenCalledTimes(1);
  });

  it('ignores a slow check result from an older run', async () => {
    const slow = deferred<CheckContext>();
    const fast = deferred<CheckContext>();
    buildContextMock.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const { hook } = setup();

    // Run 1 would pass (two arms); run 2 fails (one arm).
    act(() => {
      hook.result.current.onBlocksChange(change(SOLUTION));
    });
    await advance(100);
    const oneArm = program(null, layer(sound('cp')));
    act(() => {
      hook.result.current.onBlocksChange(change(oneArm));
    });
    await advance(100);
    expect(buildContextMock).toHaveBeenCalledTimes(2);

    fast.resolve(context(oneArm, false));
    await flush();
    slow.resolve(context(SOLUTION, false));
    await flush();

    expect(hook.result.current.runner.stepIndex).toBe(0);
    expect(hook.result.current.runner.failedChecks).toBe(1);
  });

  it('does not re-check a change that leaves the program the same', async () => {
    const { hook } = setup();
    const p = program(null, layer(sound('bd sd')));
    act(() => {
      hook.result.current.onBlocksChange(change(p));
    });
    await advance(100);
    act(() => {
      hook.result.current.onBlocksChange(change(p));
    });
    await advance(100);
    expect(buildContextMock).toHaveBeenCalledTimes(1);
  });

  it('lets a stop pressed during an in-flight play win', async () => {
    const engine = fakeEngine();
    const playDone = deferred<null>();
    engine.setPlayDelay(playDone);
    const { hook } = setup({ engine });

    act(() => {
      hook.result.current.play();
    });
    expect(engine.play).toHaveBeenCalledWith(toStrudelCode(START).code);
    act(() => {
      hook.result.current.stop();
    });
    playDone.resolve(null);
    await flush();

    expect(engine.isPlaying()).toBe(false);
    expect(engine.stop).toHaveBeenCalledTimes(2);
    expect(hook.result.current.playing).toBe(false);
  });

  it('reports a pending play while sounds load, so the transport can offer Stop', async () => {
    const engine = fakeEngine();
    const playDone = deferred<null>();
    engine.setPlayDelay(playDone);
    const { hook } = setup({ engine });

    act(() => {
      hook.result.current.play();
    });
    expect(hook.result.current.playing).toBe(false);
    expect(hook.result.current.playRequested).toBe(true);

    act(() => {
      hook.result.current.stop();
    });
    expect(hook.result.current.playRequested).toBe(false);
    playDone.resolve(null);
    await flush();
    expect(hook.result.current.playRequested).toBe(false);
    expect(engine.isPlaying()).toBe(false);
  });

  it('clears the pending play once sound starts', async () => {
    const engine = fakeEngine();
    const playDone = deferred<null>();
    engine.setPlayDelay(playDone);
    const { hook } = setup({ engine });

    act(() => {
      hook.result.current.play();
    });
    playDone.resolve(null);
    await flush();

    expect(hook.result.current.playing).toBe(true);
    expect(hook.result.current.playRequested).toBe(false);
  });

  it('reports playing once play resolves, and only passes evalInfo for the current code', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    expect(hook.result.current.playing).toBe(true);
    expect(hook.result.current.evalInfo).toBe(evaluated);

    // A newer program makes the old evaluation stale before its own result arrives.
    const pending = deferred<EvalInfo | null>();
    engine.update.mockReturnValueOnce(pending.promise);
    act(() => {
      hook.result.current.onBlocksChange(change(program(null, layer(sound('sd')))));
    });
    expect(hook.result.current.evalInfo).toBeNull();
    await advance(100);
    pending.resolve(null);
    await flush();
    expect(hook.result.current.evalInfo).toBeNull();
  });
});

describe('useLessonSession: one evaluation in flight (Review Focus 4)', () => {
  const codeOf = (p: Program) => toStrudelCode(p).code;
  const infoFor = (tag: number): EvalInfo => ({
    pattern: {} as EvalInfo['pattern'],
    miniLocations: [[0, tag]],
  });

  /** Each edit lands after the debounce, so each reaches the playback queue. */
  async function edit(hook: ReturnType<typeof setup>['hook'], p: Program): Promise<void> {
    act(() => {
      hook.result.current.onBlocksChange(change(p));
    });
    await advance(100);
  }

  it('holds later updates until the in-flight one settles, then sends only the latest', async () => {
    const { engine, hook } = setup();
    const a = program(null, layer(sound('bd')), layer(sound('a')));
    const b = program(null, layer(sound('b')));
    const c = program(null, layer(sound('c')));
    const d = program(null, layer(sound('d')));
    const inFlight = deferred<EvalInfo | null>();
    const followUp = deferred<EvalInfo | null>();
    engine.update.mockReturnValueOnce(inFlight.promise).mockReturnValueOnce(followUp.promise);

    await edit(hook, a);
    expect(engine.update).toHaveBeenCalledTimes(1);
    expect(engine.update).toHaveBeenLastCalledWith(codeOf(a));

    // Three edits while A is still evaluating: none is sent yet.
    await edit(hook, b);
    await edit(hook, c);
    await edit(hook, d);
    expect(engine.update).toHaveBeenCalledTimes(1);

    inFlight.resolve(infoFor(1));
    await flush();
    // They collapse into one follow-up with the latest code.
    expect(engine.update).toHaveBeenCalledTimes(2);
    expect(engine.update).toHaveBeenLastCalledWith(codeOf(d));
    expect(hook.result.current.evalInfo).toBeNull();

    const latest = infoFor(4);
    followUp.resolve(latest);
    await flush();
    expect(hook.result.current.evalInfo).toBe(latest);
    await advance(1_000);
    expect(engine.update).toHaveBeenCalledTimes(2);
  });

  it('never reports a superseded result, even when the code ends up the same again', async () => {
    const { engine, hook } = setup();
    const a = program(null, layer(sound('a')));
    const b = program(null, layer(sound('b')));
    const inFlight = deferred<EvalInfo | null>();
    const followUp = deferred<EvalInfo | null>();
    engine.update.mockReturnValueOnce(inFlight.promise).mockReturnValueOnce(followUp.promise);

    await edit(hook, a);
    await edit(hook, b);
    await edit(hook, a);
    const stale = infoFor(1);
    inFlight.resolve(stale);
    await flush();
    // A's first result arrived while a newer evaluation of A was queued: it is not reported.
    expect(hook.result.current.evalInfo).toBeNull();
    expect(engine.update).toHaveBeenCalledTimes(2);
    expect(engine.update).toHaveBeenLastCalledWith(codeOf(a));

    const fresh = infoFor(2);
    followUp.resolve(fresh);
    await flush();
    expect(hook.result.current.evalInfo).toBe(fresh);
  });
});

describe('useLessonSession: typos', () => {
  const typo = new Error('[mini] parse error at line 1');
  const brokenSource = sound('bd [sd hh');
  // One arm each, so the fixture step's two-arm check never passes.
  const broken = program(null, layer(brokenSource));
  const fixed = program(null, layer(sound('bd [sd hh]')));

  /** The engine fails to evaluate any code with an unclosed bracket. */
  function typoEngine(): FakeEngine {
    const engine = fakeEngine();
    let lastCode = '';
    const failing = () => (lastCode.split('[').length > lastCode.split(']').length ? typo : null);
    const evaluate = (code: string): Promise<EvalInfo | null> => {
      lastCode = code;
      return Promise.resolve(failing() === null ? evaluated : null);
    };
    engine.update.mockImplementation(evaluate);
    engine.play.mockImplementation(evaluate);
    engine.evalError.mockImplementation(failing);
    return engine;
  }

  beforeAll(async () => {
    // Load the check compiler once, so locating a typo takes only a few microtasks.
    await brokenSourceIds(program(null, layer(sound('bd'))));
  });

  it('warns on the broken block and Otto says so; fixing it clears both', async () => {
    const { hook } = setup({ engine: typoEngine() });
    act(() => {
      hook.result.current.onBlocksChange(change(broken));
    });
    await advance(100);
    await flush();
    expect(hook.result.current.evalError).toEqual({
      message: typo.message,
      nodeIds: [brokenSource.id],
    });
    expect(hook.result.current.speech.lines).toEqual([TYPO_LINE]);

    act(() => {
      hook.result.current.onBlocksChange(change(fixed));
    });
    // The warning stays until the fix has actually evaluated.
    expect(hook.result.current.evalError).not.toBeNull();
    await advance(100);
    await flush();
    expect(hook.result.current.evalError).toBeNull();
  });

  it('does not repeat the line while the pattern stays broken, but Play says it again', async () => {
    const { hook } = setup({ engine: typoEngine() });
    act(() => {
      hook.result.current.onBlocksChange(change(broken));
    });
    await advance(100);
    await flush();
    const first = hook.result.current.speech.key;

    const stillBroken = program(null, layer(sound('cp [sd')));
    act(() => {
      hook.result.current.onBlocksChange(change(stillBroken));
    });
    await advance(100);
    await flush();
    expect(hook.result.current.speech.key).toBe(first);

    act(() => {
      hook.result.current.play();
    });
    await flush();
    expect(hook.result.current.speech.key).not.toBe(first);
    expect(hook.result.current.speech.lines).toEqual([TYPO_LINE]);
    expect(hook.result.current.playing).toBe(false);
  });

  it('a typo replaces a pending hint offer: the learner is busy, not idle', async () => {
    const { hook } = setup({ engine: typoEngine() });
    clock = T0 + IDLE_MS;
    await advance(1_000);
    expect(hook.result.current.runner.offer).toBe(true);

    act(() => {
      hook.result.current.onBlocksChange(change(broken));
    });
    await advance(100);
    await flush();
    expect(hook.result.current.runner.offer).toBe(false);
    expect(hook.result.current.speech.lines).toEqual([TYPO_LINE]);
  });

  it('moves the warning to a replacement block with the same broken text', async () => {
    const engine = typoEngine();
    const { hook } = setup({ engine });
    act(() => {
      hook.result.current.onBlocksChange(change(broken));
    });
    await advance(100);
    await flush();
    expect(hook.result.current.evalError?.nodeIds).toEqual([brokenSource.id]);

    const replacement = sound('bd [sd hh');
    act(() => {
      hook.result.current.onBlocksChange(change(program(null, layer(replacement))));
    });
    await advance(100);
    await flush();
    // Identical code isn't evaluated again, but the warning follows the block now there.
    expect(engine.update).toHaveBeenCalledTimes(1);
    expect(hook.result.current.evalError).toEqual({
      message: typo.message,
      nodeIds: [replacement.id],
    });
  });

  it('pressing Play on a broken pattern from silence says so', async () => {
    const { hook } = setup({ engine: typoEngine() });
    act(() => {
      hook.result.current.onBlocksChange(change(broken));
    });
    act(() => {
      hook.result.current.play();
    });
    await flush();
    expect(hook.result.current.playing).toBe(false);
    expect(hook.result.current.speech.lines).toEqual([TYPO_LINE]);
    expect(hook.result.current.evalError?.nodeIds).toEqual([brokenSource.id]);
  });
});

describe('useLessonSession: steps, hints and success', () => {
  it('climbs the hint ladder: nudge, then point, then show me', async () => {
    const seen: Highlight[] = [];
    const unsubscribe = highlightBus.subscribe((h) => {
      seen.push(h);
    });
    const { hook } = setup();

    act(() => {
      hook.result.current.requestHint();
    });
    expect(hook.result.current.currentHintText).toBe('How many arms do you have?');
    expect(hook.result.current.speech.lines).toEqual(['How many arms do you have?']);
    expect(seen).toEqual([]);

    act(() => {
      hook.result.current.requestHint();
    });
    expect(hook.result.current.currentHintText).toBe('Grab another arm block.');
    // Long enough to follow the pointer; content may still set its own ttl.
    // The arms already in the program glow in the code pane too.
    expect(seen).toStrictEqual([
      { ttlMs: 6000, blockTypes: ['ogl_layer'], nodeIds: [START.layers[0]?.id] },
    ]);

    act(() => {
      hook.result.current.requestHint();
    });
    expect(hook.result.current.currentHintText).toBe(SHOW_ME_LINE);
    expect(hook.result.current.loadRequest?.program).toBe(SOLUTION);
    // Undo can take the learner back to their own attempt.
    expect(hook.result.current.loadRequest?.keepUndo).toBe(true);

    // Once the blocks pane reports the loaded program, the request is cleared.
    act(() => {
      hook.result.current.onBlocksChange(change(SOLUTION));
    });
    expect(hook.result.current.loadRequest).toBeNull();
    unsubscribe();
    await advance(100);
  });

  it('gives each presentation its own key, even with identical lines', () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.requestHint();
      hook.result.current.requestHint();
      hook.result.current.requestHint();
    });
    const first = hook.result.current.speech.key;
    act(() => {
      hook.result.current.requestHint();
    });
    expect(hook.result.current.speech.lines).toEqual([SHOW_ME_LINE]);
    expect(hook.result.current.speech.key).not.toBe(first);
  });

  it('advances on a passing check: glows the change, cheers, loads the next start, saves', async () => {
    const seen: Highlight[] = [];
    const unsubscribe = highlightBus.subscribe((h) => {
      seen.push(h);
    });
    const { hook } = setup();
    // The pane reports the start program first (as it does after loading).
    act(() => {
      hook.result.current.onBlocksChange(change(START));
    });
    await advance(100);
    const solved = { ...START, layers: [...START.layers, layer(sound('hh*8'))] };
    act(() => {
      hook.result.current.onBlocksChange(change(solved, { mine: 1 }));
    });
    await advance(100);
    await flush();

    // The new arm: its source and its whole `$:` line.
    const added = solved.layers[1];
    expect(seen).toEqual([{ nodeIds: [added?.source.id, added?.id] }]);
    expect(hook.result.current.runner.stepIndex).toBe(1);
    expect(hook.result.current.cheering).toBe(true);
    expect(hook.result.current.speech.lines).toEqual(['Two arms!', 'Play with it.']);
    expect(hook.result.current.loadRequest?.program).toBe(JAM_START);
    expect(hook.result.current.loadRequest?.keepUndo).toBe(false);
    expect(loadState().lessonProgress['fixture']).toEqual({ stepIndex: 1, completed: false });
    // The next step has its own start: the old workspace is dropped with the same save, so a
    // reload restores that start, never the new step with the old step's blocks.
    expect(loadState().workspaces['fixture']).toBeUndefined();

    await advance(5_000);
    expect(hook.result.current.cheering).toBe(false);
    unsubscribe();
  });

  it('keeps the learner’s workspace when the next step has no start of its own', async () => {
    const { hook } = setup({ course: fixtureWith([TWO_ARMS, { ...JAM, start: undefined }]) });
    act(() => {
      hook.result.current.onBlocksChange(change(SOLUTION, { mine: 1 }));
    });
    await advance(100);
    await flush();

    expect(hook.result.current.runner.stepIndex).toBe(1);
    expect(hook.result.current.loadRequest).toBeNull();
    expect(loadState().lessonProgress['fixture']).toEqual({ stepIndex: 1, completed: false });
    expect(loadState().workspaces['fixture']).toEqual({ mine: 1 });
  });

  it('completes the lesson from a manual step and records it', async () => {
    saveState({
      version: 1,
      lessonProgress: { fixture: { stepIndex: 1, completed: false } },
      workspaces: {},
    });
    const { hook } = setup();
    act(() => {
      hook.result.current.manualNext();
    });
    expect(hook.result.current.runner.completed).toBe(true);
    expect(hook.result.current.speech.lines[0]).toBe('Lovely.');
    expect(hook.result.current.hasNextLesson).toBe(true);
    expect(loadState().lessonProgress['fixture']).toEqual({ stepIndex: 1, completed: true });
    await advance(100);
  });

  it('offers a hint after idling, and acts on the answer', async () => {
    const { hook } = setup();
    clock = T0 + IDLE_MS;
    await advance(1_000);
    expect(hook.result.current.runner.offer).toBe(true);

    act(() => {
      hook.result.current.dismissOffer();
    });
    expect(hook.result.current.runner.offer).toBe(false);
    expect(hook.result.current.currentHintText).toBeNull();

    clock = T0 + 2 * IDLE_MS + 1;
    await advance(1_000);
    expect(hook.result.current.runner.offer).toBe(true);
    act(() => {
      hook.result.current.acceptOffer();
    });
    expect(hook.result.current.runner.offer).toBe(false);
    expect(hook.result.current.currentHintText).toBe('How many arms do you have?');
  });

  it('saves the workspace on every change', () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.onBlocksChange(change(START, { n: 1 }));
    });
    expect(loadState().workspaces['fixture']).toEqual({ n: 1 });
    act(() => {
      hook.result.current.onBlocksChange(change(START, { n: 2 }));
    });
    expect(loadState().workspaces['fixture']).toEqual({ n: 2 });
  });
});

describe('useLessonSession: hear the goal', () => {
  it('plays the target, and a workspace change returns to the learner’s program', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.toggleTarget();
    });
    expect(hook.result.current.targetPlaying).toBe(true);
    expect(engine.play).toHaveBeenLastCalledWith(toStrudelCode(TARGET).code);
    await flush();
    expect(hook.result.current.playing).toBe(true);

    const edited = program(null, layer(sound('bd sd')));
    act(() => {
      hook.result.current.onBlocksChange(change(edited));
    });
    expect(hook.result.current.targetPlaying).toBe(false);
    await flush();
    // The learner wasn't playing, so the goal stops and their code is loaded but silent.
    expect(engine.isPlaying()).toBe(false);
    expect(engine.update).toHaveBeenLastCalledWith(toStrudelCode(edited).code);
    expect(hook.result.current.playing).toBe(false);
  });

  it('Play while the goal is on returns to the learner’s program', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.toggleTarget();
    });
    act(() => {
      hook.result.current.play();
    });
    expect(hook.result.current.targetPlaying).toBe(false);
    await flush();
    // Queued behind the goal's in-flight evaluation, then played.
    expect(engine.play).toHaveBeenLastCalledWith(toStrudelCode(START).code);
    expect(engine.isPlaying()).toBe(true);
  });

  it('drops the goal state when the goal fails to evaluate', async () => {
    const engine = fakeEngine();
    engine.play.mockImplementationOnce(() => Promise.resolve(null));
    const { hook } = setup({ engine });
    act(() => {
      hook.result.current.toggleTarget();
    });
    expect(hook.result.current.targetPlaying).toBe(true);
    await flush();
    expect(hook.result.current.targetPlaying).toBe(false);
    expect(hook.result.current.playing).toBe(false);
  });

  it('does not count the goal, still sounding, as the learner playing', async () => {
    const playingTwoArms: Step = {
      ...TWO_ARMS,
      check: { kind: 'all', checks: [{ kind: 'playing' }, { kind: 'layers', min: 2 }] },
    };
    const { engine, hook } = setup({ course: fixtureWith([playingTwoArms, JAM]) });
    act(() => {
      hook.result.current.play();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();

    const restore = deferred<EvalInfo | null>();
    engine.update.mockReturnValueOnce(restore.promise);
    act(() => {
      hook.result.current.onBlocksChange(change(SOLUTION));
    });
    await advance(100);
    await flush();
    // The goal's pattern is still the one sounding.
    expect(buildContextMock).toHaveBeenLastCalledWith(SOLUTION, false);
    expect(hook.result.current.runner.stepIndex).toBe(0);

    restore.resolve(evaluated);
    await flush();
    expect(buildContextMock).toHaveBeenLastCalledWith(SOLUTION, true);
    expect(hook.result.current.runner.stepIndex).toBe(1);
  });

  it('stops the goal when the learner’s edit back from it fails to evaluate', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();

    // A typo: the engine keeps its last pattern, which is the goal's.
    engine.update.mockResolvedValueOnce(null);
    act(() => {
      hook.result.current.onBlocksChange(change(program(null, layer(sound('bd [sd')))));
    });
    await flush();
    expect(engine.isPlaying()).toBe(false);
    expect(hook.result.current.playing).toBe(false);
  });

  it('stops the goal that lands after the learner left it, when their edit then fails', async () => {
    const engine = fakeEngine();
    const { hook } = setup({ engine });
    act(() => {
      hook.result.current.play();
    });
    await flush();

    // The goal is still evaluating when the learner edits (a typo) and so returns to their own.
    const goalDone = deferred<null>();
    engine.setPlayDelay(goalDone);
    act(() => {
      hook.result.current.toggleTarget();
    });
    engine.update.mockResolvedValueOnce(null);
    act(() => {
      hook.result.current.onBlocksChange(change(program(null, layer(sound('bd [sd')))));
    });
    expect(hook.result.current.targetPlaying).toBe(false);

    goalDone.resolve(null);
    await flush();

    // The goal's pattern did install, and the learner's edit didn't replace it: stop it.
    expect(engine.isPlaying()).toBe(false);
    expect(hook.result.current.playing).toBe(false);
  });

  it('keeps the learner’s restored sound when a later queued edit fails', async () => {
    const restoredCode = program(null, layer(sound('bd sd')));
    const brokenCode = program(null, layer(sound('bd [sd')));
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();

    // A (valid) is still evaluating when B (broken) queues behind it.
    const restoreA = deferred<EvalInfo | null>();
    engine.update.mockReturnValueOnce(restoreA.promise).mockResolvedValueOnce(null);
    act(() => {
      hook.result.current.onBlocksChange(change(restoredCode));
    });
    await flush();
    act(() => {
      hook.result.current.onBlocksChange(change(brokenCode));
    });
    await advance(100);
    await flush();
    const stopsBefore = engine.stop.mock.calls.length;

    // A installs the learner's pattern; its result is superseded by B, which then fails.
    restoreA.resolve(evaluated);
    await flush();

    expect(engine.update).toHaveBeenLastCalledWith(toStrudelCode(brokenCode).code);
    expect(engine.stop.mock.calls.length).toBe(stopsBefore);
    expect(engine.isPlaying()).toBe(true);
    expect(hook.result.current.playing).toBe(true);
  });

  it('keeps playing when the learner’s edit back from the goal evaluates', async () => {
    const edited = program(null, layer(sound('bd sd')));
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();

    act(() => {
      hook.result.current.onBlocksChange(change(edited));
    });
    await flush();
    expect(engine.update).toHaveBeenLastCalledWith(toStrudelCode(edited).code);
    expect(engine.isPlaying()).toBe(true);
    expect(hook.result.current.playing).toBe(true);
  });

  it('toggling again keeps the learner playing if they were', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();
    act(() => {
      hook.result.current.toggleTarget();
    });
    await flush();
    expect(hook.result.current.targetPlaying).toBe(false);
    expect(engine.isPlaying()).toBe(true);
    expect(engine.update).toHaveBeenLastCalledWith(toStrudelCode(START).code);
  });
});

describe('useLessonSession: leaving', () => {
  it('stops playback on unmount', async () => {
    const { engine, hook } = setup();
    act(() => {
      hook.result.current.play();
    });
    await flush();
    hook.unmount();
    expect(engine.isPlaying()).toBe(false);
  });
});
