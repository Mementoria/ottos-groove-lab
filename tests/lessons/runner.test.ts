import { describe, expect, it } from 'vitest';
import { FAILS_BEFORE_OFFER, IDLE_MS, initRunner, reduce } from '../../src/lessons/runner';
import type { RunnerState } from '../../src/lessons/runner';
import type { Lesson, Step } from '../../src/lessons/types';
import { layer, program, sound } from '../../src/program/build';

function step(id: string, kind: 'playing' | 'manual'): Step {
  const hint = { say: 'try again' };
  return {
    id,
    label: id,
    type: 'guided',
    say: ['hi'],
    check: { kind },
    hints: [hint, hint],
    solution: program(null, layer(sound('bd'))),
    success: 'nice',
  };
}

const lesson: Lesson = {
  id: 'fixture',
  module: 0,
  title: 'Fixture',
  unlocks: [],
  codePane: 'collapsed',
  spectrum: false,
  steps: [step('a', 'playing'), step('b', 'manual'), step('c', 'playing')],
};

const T0 = 1_000;

function at(overrides: Partial<RunnerState>): RunnerState {
  return { ...initRunner(T0), ...overrides };
}

describe('initRunner', () => {
  it('starts at step 0 with nothing shown', () => {
    expect(initRunner(T0)).toEqual({
      stepIndex: 0,
      completed: false,
      hintLevel: 0,
      failedChecks: 0,
      idleSince: T0,
      offer: false,
    });
  });
});

describe('checked', () => {
  it('advances on pass and resets per-step state', () => {
    const s = at({ hintLevel: 2, failedChecks: 3, offer: true });
    expect(reduce(lesson, s, { type: 'checked', pass: true, now: 5_000 })).toEqual({
      stepIndex: 1,
      completed: false,
      hintLevel: 0,
      failedChecks: 0,
      idleSince: 5_000,
      offer: false,
    });
  });

  it('completes the lesson on the last step', () => {
    const s = at({ stepIndex: 2 });
    const next = reduce(lesson, s, { type: 'checked', pass: true, now: 2_000 });
    expect(next.completed).toBe(true);
    expect(next.stepIndex).toBe(2);
  });

  it('counts failures', () => {
    const s = reduce(lesson, at({}), { type: 'checked', pass: false, now: 2_000 });
    expect(s.failedChecks).toBe(1);
    expect(s.stepIndex).toBe(0);
  });

  it('ignores a pass on a manual step', () => {
    const s = at({ stepIndex: 1 });
    expect(reduce(lesson, s, { type: 'checked', pass: true, now: 2_000 })).toBe(s);
  });
});

describe('manualNext', () => {
  it('advances a manual step', () => {
    const next = reduce(lesson, at({ stepIndex: 1 }), { type: 'manualNext', now: 3_000 });
    expect(next.stepIndex).toBe(2);
    expect(next.idleSince).toBe(3_000);
  });

  it('is ignored on a non-manual step', () => {
    const s = at({});
    expect(reduce(lesson, s, { type: 'manualNext', now: 3_000 })).toBe(s);
  });
});

describe('tick', () => {
  it('offers after IDLE_MS of idleness', () => {
    expect(reduce(lesson, at({}), { type: 'tick', now: T0 + IDLE_MS }).offer).toBe(true);
  });

  it('does not offer one millisecond early', () => {
    expect(reduce(lesson, at({}), { type: 'tick', now: T0 + IDLE_MS - 1 }).offer).toBe(false);
  });

  it('offers after FAILS_BEFORE_OFFER failed checks', () => {
    const s = at({ failedChecks: FAILS_BEFORE_OFFER });
    expect(reduce(lesson, s, { type: 'tick', now: T0 + 1 }).offer).toBe(true);
    const fewer = at({ failedChecks: FAILS_BEFORE_OFFER - 1 });
    expect(reduce(lesson, fewer, { type: 'tick', now: T0 + 1 }).offer).toBe(false);
  });

  it('never offers once every rung has been shown', () => {
    const s = at({ hintLevel: 3, failedChecks: 99 });
    expect(reduce(lesson, s, { type: 'tick', now: T0 + IDLE_MS * 10 }).offer).toBe(false);
  });

  it('never offers after completion', () => {
    const s = at({ completed: true });
    expect(reduce(lesson, s, { type: 'tick', now: T0 + IDLE_MS * 10 })).toBe(s);
  });
});

describe('hint', () => {
  it('climbs one rung, clears the offer and resets the clocks', () => {
    const s = at({ offer: true, failedChecks: 4 });
    expect(reduce(lesson, s, { type: 'hint', now: 9_000 })).toEqual({
      ...s,
      hintLevel: 1,
      offer: false,
      failedChecks: 0,
      idleSince: 9_000,
    });
  });

  it('caps at rung 3', () => {
    let s = at({});
    for (let i = 0; i < 5; i += 1) s = reduce(lesson, s, { type: 'hint', now: T0 + i });
    expect(s.hintLevel).toBe(3);
  });
});

describe('dismissOffer', () => {
  it('clears the offer and restarts the clocks', () => {
    const s = at({ offer: true, failedChecks: 5 });
    expect(reduce(lesson, s, { type: 'dismissOffer', now: 7_000 })).toEqual({
      ...s,
      offer: false,
      failedChecks: 0,
      idleSince: 7_000,
    });
  });
});

describe('completed lesson', () => {
  it('treats every event as a no-op', () => {
    const s = at({ completed: true, stepIndex: 2 });
    for (const e of [
      { type: 'checked', pass: true, now: 1 },
      { type: 'checked', pass: false, now: 1 },
      { type: 'hint', now: 1 },
      { type: 'manualNext', now: 1 },
      { type: 'dismissOffer', now: 1 },
    ] as const) {
      expect(reduce(lesson, s, e)).toBe(s);
    }
  });
});
