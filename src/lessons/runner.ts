import type { Lesson, Step } from './types';

export interface RunnerState {
  stepIndex: number;
  completed: boolean;
  /** Highest hint rung shown. */
  hintLevel: 0 | 1 | 2 | 3;
  failedChecks: number;
  /** ms timestamp of step start or last offer. */
  idleSince: number;
  /** Otto is offering the next rung. */
  offer: boolean;
}

export type RunnerEvent =
  | { type: 'checked'; pass: boolean; now: number }
  /** The learner pressed the hint button or accepted an offer. */
  | { type: 'hint'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'manualNext'; now: number }
  | { type: 'dismissOffer'; now: number };

export const IDLE_MS = 45_000;
export const FAILS_BEFORE_OFFER = 5;

export function initRunner(now: number): RunnerState {
  return {
    stepIndex: 0,
    completed: false,
    hintLevel: 0,
    failedChecks: 0,
    idleSince: now,
    offer: false,
  };
}

function advance(lesson: Lesson, s: RunnerState, now: number): RunnerState {
  if (s.stepIndex >= lesson.steps.length - 1) return { ...s, completed: true, offer: false };
  return { ...initRunner(now), stepIndex: s.stepIndex + 1 };
}

const NEXT_LEVEL = [1, 2, 3, 3] as const;

/** Open steps (and manual checks) can be finished with "Sounds right to me →". */
export function allowsManualNext(step: Step | undefined): boolean {
  return step !== undefined && (step.type === 'open' || step.check.kind === 'manual');
}

export function reduce(lesson: Lesson, s: RunnerState, e: RunnerEvent): RunnerState {
  if (s.completed) return s;
  const step = lesson.steps[s.stepIndex];
  const isManual = step?.check.kind === 'manual';
  switch (e.type) {
    case 'checked':
      if (e.pass) return isManual ? s : advance(lesson, s, e.now);
      return { ...s, failedChecks: s.failedChecks + 1 };
    case 'manualNext':
      return allowsManualNext(step) ? advance(lesson, s, e.now) : s;
    case 'tick': {
      if (s.hintLevel >= 3 || s.offer) return s;
      const due = e.now - s.idleSince >= IDLE_MS || s.failedChecks >= FAILS_BEFORE_OFFER;
      return due ? { ...s, offer: true } : s;
    }
    case 'hint':
      return {
        ...s,
        hintLevel: NEXT_LEVEL[s.hintLevel],
        offer: false,
        failedChecks: 0,
        idleSince: e.now,
      };
    case 'dismissOffer':
      return { ...s, offer: false, idleSince: e.now, failedChecks: 0 };
  }
}
