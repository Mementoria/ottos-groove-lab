import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AudioEngine, EvalInfo } from '../audio/engine';
import type { BlocksPaneChange, BlocksPaneInitial, LoadRequest } from '../blocks/BlocksPane';
import type { BlockType } from '../blocks/blockTypes';
import { nodeIdsOfTypes } from '../blocks/convert';
import { buildContext, runCheck } from '../checkers/checks';
import { course as defaultCourse, unlockedFor } from '../lessons/content';
import { initRunner, reduce, type RunnerEvent, type RunnerState } from '../lessons/runner';
import type { Lesson, Step } from '../lessons/types';
import { highlightBus, type Highlight } from '../otto/highlightBus';
import { toStrudelCode, type Generated } from '../program/codegen';
import type { Program } from '../program/types';
import { loadState, saveState, type SavedState } from './storage';
import { brokenSourceIds } from './typos';

export const DEFAULT_DEBOUNCE_MS = 400;
const TICK_MS = 1000;
const CHEER_MS = 1800;
/** How long a rung-2 "point" glows unless the content sets its own ttl. */
export const HINT_HIGHLIGHT_MS = 6000;

export const SHOW_ME_LINE = 'Here, let me show you.';
const DISMISS_LINE = 'No problem. The 💡 is there whenever you want it.';
const NOTHING_TO_PLAY_LINE = "There's nothing to play yet. Drag an arm into the workspace first.";
const NEXT_LESSON_LINE = "That's the lesson done. Ready for the next one?";
const LAST_LESSON_LINE = "That's every lesson so far. More are on the way!";
const REVISIT_LINE = "You've finished this one already. Keep jamming, or move on when you like.";
export const TYPO_LINE = 'Hmm, that pattern has a typo. Check your brackets and spaces.';

const EMPTY: Program = { bpm: null, layers: [] };

export interface SessionDeps {
  engine: AudioEngine;
  now?: () => number;
  debounceMs?: number;
  /** For tests; defaults to the real course. */
  course?: Lesson[];
}

/** The learner's code won't evaluate: Strudel's message, and the source blocks at fault. */
export interface EvalErrorInfo {
  message: string;
  nodeIds: string[];
}

/** What Otto is saying. `key` is new for every presentation, even of identical lines. */
export interface Speech {
  key: string;
  lines: string[];
}

export interface LessonSessionState {
  lesson: Lesson;
  runner: RunnerState;
  program: Program;
  generated: Generated;
  /** Only ever the evaluation of the current `generated.code`; null otherwise. */
  evalInfo: EvalInfo | null;
  /** Set when the learner's latest evaluated code had a typo; kept until a later one evaluates. */
  evalError: EvalErrorInfo | null;
  playing: boolean;
  targetPlaying: boolean;
  loadRequest: LoadRequest | null;
  currentHintText: string | null;
  speech: Speech;
  /** True briefly after a step succeeds. */
  cheering: boolean;
  /** For BlocksPane: saved work for this lesson if any, else the current step's start. */
  initial: BlocksPaneInitial;
  unlocked: BlockType[];
  hasNextLesson: boolean;
}

export interface LessonSessionActions {
  onBlocksChange: (r: BlocksPaneChange) => void;
  play: () => void;
  stop: () => void;
  toggleTarget: () => void;
  requestHint: () => void;
  acceptOffer: () => void;
  dismissOffer: () => void;
  manualNext: () => void;
}

export type LessonSession = LessonSessionState & LessonSessionActions;

/* ---------- playback: one evaluation in flight, latest code wins, stop wins ---------- */

interface Playback {
  play: (code: string) => void;
  update: (code: string) => void;
  stop: () => void;
  /** The learner's intent (true from play until stop), not whether sound is coming out yet. */
  wantsPlaying: () => boolean;
}

/**
 * Serialises engine evaluations. Strudel installs a pattern when its evaluation finishes, so two
 * overlapping evaluations could finish out of order and leave the older pattern playing. Here
 * only one is ever in flight; edits that arrive meanwhile collapse into one follow-up with the
 * latest code, and only the result of the latest code is reported.
 */
function createPlayback(
  engine: AudioEngine,
  onSettled: (code: string, info: EvalInfo | null, error: Error | null, played: boolean) => void,
): Playback {
  let busy = false;
  let next: { code: string; play: boolean } | null = null;
  let wantPlaying = false;

  // Read through functions: `next` changes while `pump` awaits.
  const take = (): { code: string; play: boolean } | null => {
    const job = next;
    next = null;
    return job;
  };
  const queued = (): boolean => next !== null;
  const playQueued = (): boolean => next?.play === true;

  async function pump(): Promise<void> {
    busy = true;
    try {
      for (let job = take(); job !== null; job = take()) {
        const couldStart = job.play || engine.isPlaying();
        let info: EvalInfo | null = null;
        let evalError: Error | null = null;
        try {
          info = job.play ? await engine.play(job.code) : await engine.update(job.code);
          // Read at once: the engine reports on its latest evaluation, which is this one.
          evalError = engine.evalError();
        } catch (error) {
          console.warn('Evaluation failed.', error);
        }
        // The engine marks itself playing (and Strudel starts its clock) after its await, so a
        // stop pressed while this was in flight has to be applied again now.
        if (!wantPlaying && couldStart) engine.stop();
        // Play with nothing to play, or an edit down to silence, ends the intent too.
        if (wantPlaying && !playQueued() && !engine.isPlaying()) wantPlaying = false;
        if (!queued()) onSettled(job.code, info, evalError, job.play);
      }
    } finally {
      busy = false;
    }
  }

  function kick(): void {
    if (!busy) void pump();
  }

  return {
    play(code) {
      wantPlaying = true;
      next = { code, play: true };
      kick();
    },
    update(code) {
      next = { code, play: next?.play ?? false };
      kick();
    },
    stop() {
      wantPlaying = false;
      if (next) next = { ...next, play: false };
      engine.stop();
    },
    wantsPlaying: () => wantPlaying,
  };
}

/* ---------- pure helpers ---------- */

function restoreRunner(lesson: Lesson, saved: SavedState, now: number): RunnerState {
  const runner = initRunner(now);
  const progress = saved.lessonProgress[lesson.id];
  if (!progress || lesson.steps.length === 0) return runner;
  const stepIndex = Math.min(progress.stepIndex, lesson.steps.length - 1);
  return { ...runner, stepIndex, completed: progress.completed };
}

/** The step's start, else what the learner should have built just before it (as the harness). */
function effectiveStart(
  course: readonly Lesson[],
  lessonIndex: number,
  r: RunnerState,
): Program | null {
  const lesson = course[lessonIndex];
  const step = lesson?.steps[r.stepIndex];
  if (r.completed) return step?.solution ?? null;
  if (step?.start) return step.start;
  const previous =
    r.stepIndex > 0 ? lesson?.steps[r.stepIndex - 1] : course[lessonIndex - 1]?.steps.at(-1);
  return previous?.solution ?? null;
}

function hintText(step: Step | undefined, level: RunnerState['hintLevel']): string | null {
  if (!step || level === 0) return null;
  if (level === 3) return SHOW_ME_LINE;
  return (level === 1 ? step.hints[0] : step.hints[1]).say;
}

/** Node ids whose generated text is new or different in `after`. */
function changedNodeIds(before: Program, after: Program): string[] {
  const was = toStrudelCode(before);
  const now = toStrudelCode(after);
  return Object.entries(now.spans)
    .filter(([id, [from, to]]) => {
      const old = was.spans[id];
      return old === undefined || was.code.slice(old[0], old[1]) !== now.code.slice(from, to);
    })
    .map(([id]) => id);
}

/** Adds the nodes its block types stand for in `p`, so the code spans glow with the blocks. */
function withCodeSpans(h: Highlight, p: Program): Highlight {
  const extra = nodeIdsOfTypes(p, h.blockTypes ?? []);
  if (extra.length === 0) return h;
  return { ...h, nodeIds: [...new Set([...(h.nodeIds ?? []), ...extra])] };
}

function persist(update: (s: SavedState) => SavedState): void {
  saveState(update(loadState()));
}

/* ---------- the session ---------- */

interface Internal {
  runner: RunnerState;
  program: Program;
  generated: Generated;
  evaluated: { code: string; info: EvalInfo | null } | null;
  typo: EvalErrorInfo | null;
  targetPlaying: boolean;
  loadRequest: LoadRequest | null;
  speech: Speech;
  cheering: boolean;
}

interface SessionStore {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => LessonSessionState;
  /** Starts the idle tick; the returned function stops everything (timers, sound). */
  attach: () => () => void;
  actions: LessonSessionActions;
}

/**
 * Wires program ⇄ engine ⇄ checks ⇄ runner for one lesson. A plain external store so the React
 * side is a single `useSyncExternalStore`; all timing and async ordering lives here.
 */
export function createLessonSession(lessonIndex: number, deps: SessionDeps): SessionStore {
  const { engine } = deps;
  const now = deps.now ?? Date.now;
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const course = deps.course ?? defaultCourse;
  const maybeLesson = course[lessonIndex];
  if (!maybeLesson) throw new Error(`No lesson at index ${String(lessonIndex)}`);
  const lesson: Lesson = maybeLesson;
  const unlocked = unlockedFor(lessonIndex, course);
  const hasNextLesson = lessonIndex + 1 < course.length;

  const saved = loadState();
  const savedWorkspace = saved.workspaces[lesson.id];
  const startRunner = restoreRunner(lesson, saved, now());
  const startProgram = savedWorkspace ? null : effectiveStart(course, lessonIndex, startRunner);
  const initial: BlocksPaneInitial = savedWorkspace
    ? { kind: 'saved', state: savedWorkspace }
    : startProgram
      ? { kind: 'program', program: startProgram }
      : null;

  let speechCount = 0;
  function speech(lines: string[]): Speech {
    speechCount += 1;
    return { key: `${lesson.id}:${String(state.runner.stepIndex)}:${String(speechCount)}`, lines };
  }

  const firstProgram = startProgram ?? EMPTY;
  let state: Internal = {
    runner: startRunner,
    program: firstProgram,
    generated: toStrudelCode(firstProgram),
    evaluated: null,
    typo: null,
    targetPlaying: false,
    loadRequest: null,
    speech: { key: '', lines: [] },
    cheering: false,
  };
  state.speech = speech(
    startRunner.completed ? [REVISIT_LINE] : (lesson.steps[startRunner.stepIndex]?.say ?? []),
  );

  /* -- store plumbing -- */

  const listeners = new Set<() => void>();
  let snapshot = toSnapshot();

  function toSnapshot(): LessonSessionState {
    const { evaluated, generated, runner } = state;
    return {
      lesson,
      runner,
      program: state.program,
      generated,
      evalInfo: evaluated?.code === generated.code ? evaluated.info : null,
      evalError: state.typo,
      playing: engine.isPlaying(),
      targetPlaying: state.targetPlaying,
      loadRequest: state.loadRequest,
      currentHintText: hintText(lesson.steps[runner.stepIndex], runner.hintLevel),
      speech: state.speech,
      cheering: state.cheering,
      initial,
      unlocked,
      hasNextLesson,
    };
  }

  function set(patch: Partial<Internal>): void {
    state = { ...state, ...patch };
    publish();
  }

  function publish(): void {
    snapshot = toSnapshot();
    for (const listener of [...listeners]) listener();
  }

  /* -- timers and async bookkeeping -- */

  let attached = false;
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let cheerTimer: ReturnType<typeof setTimeout> | undefined;
  let nonce = 0;
  /** Bumped whenever an in-flight check result stops being wanted. */
  let checkSeq = 0;
  /** What the last still-valid check was computed from. */
  let checkedKey: string | null = null;
  /** The code last handed to the engine (learner's or target). */
  let sentCode: string | null = null;
  /** Whether the learner was playing when "hear the goal" took over. */
  let learnerWasPlaying = false;
  /** The goal's code while it is on. */
  let targetCode: string | null = null;
  /** The program the current step began with, for the success glow. */
  let baseline: Program | null = startProgram;
  /** Bumped whenever a pending typo lookup stops being wanted. */
  let typoSeq = 0;

  const playback = createPlayback(engine, (code, info, error, played) => {
    if (!attached) return;
    // A goal that won't evaluate hands back to the learner rather than claiming to play.
    if (state.targetPlaying && code === targetCode && info === null) returnToLearner();
    set({ evaluated: { code, info } });
    noteTypo(code, error, played);
    // `playing` may have just turned true, which a check can depend on.
    if (!state.targetPlaying) check();
  });

  const currentStep = (): Step | undefined => lesson.steps[state.runner.stepIndex];

  /** Whether sound is the learner's: the goal playing doesn't count for the "playing" check. */
  const learnerPlaying = (): boolean => engine.isPlaying() && !state.targetPlaying;

  function checkKey(): string {
    const { runner, program, generated } = state;
    return [runner.stepIndex, learnerPlaying(), program.layers.length, generated.code].join('\n');
  }

  /** Drops any in-flight result computed from something other than the current state. */
  function invalidateIfStale(): void {
    if (checkKey() === checkedKey) return;
    checkSeq += 1;
    checkedKey = null;
  }

  function check(): void {
    const step = currentStep();
    if (!step || state.runner.completed || step.check.kind === 'manual') return;
    const key = checkKey();
    if (key === checkedKey) return;
    checkedKey = key;
    checkSeq += 1;
    const seq = checkSeq;
    const { program } = state;
    const { stepIndex } = state.runner;
    buildContext(program, learnerPlaying())
      .then(
        (ctx) => runCheck(step.check, ctx).pass,
        (error: unknown) => {
          console.warn('Check could not run.', error);
          return false;
        },
      )
      .then((pass) => {
        if (!attached || seq !== checkSeq || state.runner.stepIndex !== stepIndex) return;
        dispatch({ type: 'checked', pass, now: now() }, program);
      })
      .catch((error: unknown) => {
        console.warn('Check result could not be applied.', error);
      });
  }

  /**
   * Keeps the typo state in step with the learner's evaluations. A failure finds the broken
   * layers' source blocks; Otto mentions it when it first appears, or when Play is pressed.
   */
  function noteTypo(code: string, error: Error | null, played: boolean): void {
    // Only the learner's current code counts (not the goal's, and not code already replaced:
    // its own evaluation is on the way).
    if (code !== state.generated.code || code === targetCode) return;
    typoSeq += 1;
    if (error === null) {
      if (state.typo !== null) set({ typo: null });
      return;
    }
    const seq = typoSeq;
    const announce = played || state.typo === null;
    brokenSourceIds(state.program)
      .then((nodeIds) => {
        if (!attached || seq !== typoSeq) return;
        const typo = { message: error.message, nodeIds };
        if (!announce) {
          set({ typo });
          return;
        }
        // The learner is busy, not idle: a pending hint offer would hide the line, so drop it.
        const { runner } = state;
        const next = runner.offer
          ? reduce(lesson, runner, { type: 'dismissOffer', now: now() })
          : runner;
        set({ typo, runner: next, speech: speech([TYPO_LINE]) });
      })
      .catch((reason: unknown) => {
        console.warn('Could not locate the typo.', reason);
      });
  }

  function run(): void {
    debounceTimer = undefined;
    if (!state.targetPlaying && state.generated.code !== sentCode) {
      sentCode = state.generated.code;
      playback.update(sentCode);
    }
    check();
  }

  function schedule(): void {
    invalidateIfStale();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, debounceMs);
  }

  /** `keepUndo` for "Show me", so the learner can undo back to their own attempt. */
  function requestLoad(program: Program, keepUndo: boolean): void {
    nonce += 1;
    set({ loadRequest: { program, nonce, keepUndo } });
  }

  function cheer(): void {
    clearTimeout(cheerTimer);
    set({ cheering: true });
    cheerTimer = setTimeout(() => {
      set({ cheering: false });
    }, CHEER_MS);
  }

  function returnToLearner(): void {
    if (!state.targetPlaying) return;
    targetCode = null;
    if (!learnerWasPlaying) playback.stop();
    sentCode = state.generated.code;
    playback.update(sentCode);
    set({ targetPlaying: false });
  }

  /* -- runner transitions -- */

  function dispatch(e: RunnerEvent, checkedProgram: Program = state.program): void {
    const prev = state.runner;
    const next = reduce(lesson, prev, e);
    if (next === prev) return;
    state = { ...state, runner: next };

    if (next.stepIndex !== prev.stepIndex || next.completed !== prev.completed) {
      finishStep(prev, next, checkedProgram);
    } else if (e.type === 'hint') {
      presentHint(next.hintLevel);
    } else if (e.type === 'dismissOffer' && prev.offer) {
      state = { ...state, speech: speech([DISMISS_LINE]) };
    }
    publish();
  }

  function finishStep(prev: RunnerState, next: RunnerState, checkedProgram: Program): void {
    const finished = lesson.steps[prev.stepIndex];
    const changed = changedNodeIds(baseline ?? EMPTY, checkedProgram);
    if (changed.length > 0) highlightBus.emit({ nodeIds: changed });
    cheer();
    returnToLearner();
    persist((s) => ({
      ...s,
      lessonProgress: {
        ...s.lessonProgress,
        [lesson.id]: { stepIndex: next.stepIndex, completed: next.completed },
      },
    }));

    const success = finished ? [finished.success] : [];
    if (next.completed) {
      set({ speech: speech([...success, hasNextLesson ? NEXT_LESSON_LINE : LAST_LESSON_LINE]) });
      return;
    }
    const step = lesson.steps[next.stepIndex];
    set({ speech: speech([...success, ...(step?.say ?? [])]) });
    baseline = step?.start ?? checkedProgram;
    if (step?.start) requestLoad(step.start, false);
    // The new step may already be satisfied (e.g. "press play" while playing).
    schedule();
  }

  function presentHint(level: RunnerState['hintLevel']): void {
    const step = currentStep();
    const text = hintText(step, level);
    if (!step || text === null) return;
    state = { ...state, speech: speech([text]) };
    const point = step.hints[1].highlight;
    if (level === 2 && point) {
      highlightBus.emit(withCodeSpans({ ttlMs: HINT_HIGHLIGHT_MS, ...point }, state.program));
    }
    if (level === 3) requestLoad(step.solution, true);
  }

  /* -- actions -- */

  const actions: LessonSessionActions = {
    onBlocksChange(r) {
      const generated = toStrudelCode(r.program);
      baseline ??= r.program;
      persist((s) => ({ ...s, workspaces: { ...s.workspaces, [lesson.id]: r.state } }));
      set({ program: r.program, generated, loadRequest: null });
      returnToLearner();
      schedule();
    },
    play() {
      // Play always means the learner's program, even while the goal is on (or loading).
      const wasTarget = state.targetPlaying;
      targetCode = null;
      if (state.generated.code.trim() === '') {
        if (wasTarget) playback.stop();
        set({ targetPlaying: false, speech: speech([NOTHING_TO_PLAY_LINE]) });
        return;
      }
      sentCode = state.generated.code;
      playback.play(sentCode);
      set({ targetPlaying: false });
    },
    stop() {
      playback.stop();
      set({ targetPlaying: false });
    },
    toggleTarget() {
      if (state.targetPlaying) {
        returnToLearner();
        return;
      }
      const target = currentStep()?.target;
      if (!target || state.runner.completed) return;
      learnerWasPlaying = playback.wantsPlaying();
      targetCode = toStrudelCode(target).code;
      sentCode = targetCode;
      playback.play(sentCode);
      set({ targetPlaying: true });
    },
    requestHint() {
      dispatch({ type: 'hint', now: now() });
    },
    acceptOffer() {
      dispatch({ type: 'hint', now: now() });
    },
    dismissOffer() {
      dispatch({ type: 'dismissOffer', now: now() });
    },
    manualNext() {
      dispatch({ type: 'manualNext', now: now() });
    },
  };

  return {
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot: () => snapshot,
    attach() {
      attached = true;
      tickTimer = setInterval(() => {
        dispatch({ type: 'tick', now: now() });
      }, TICK_MS);
      return () => {
        attached = false;
        clearInterval(tickTimer);
        clearTimeout(debounceTimer);
        clearTimeout(cheerTimer);
        playback.stop();
        // StrictMode re-attaches; the next run must evaluate again.
        sentCode = null;
        checkedKey = null;
        checkSeq += 1;
      };
    },
    actions,
  };
}

/**
 * One lesson's live session. The lesson, engine and deps are fixed for the hook's lifetime:
 * key the component by lesson so a new lesson gets a new session.
 */
export function useLessonSession(lessonIndex: number, deps: SessionDeps): LessonSession {
  const [session] = useState(() => createLessonSession(lessonIndex, deps));
  useEffect(() => session.attach(), [session]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { ...snapshot, ...session.actions };
}
