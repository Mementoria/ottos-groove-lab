// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContext, runCheck } from '../../src/checkers/checks';
import { course } from '../../src/lessons/content';
import type { Step } from '../../src/lessons/types';
import type { Modifier, Program, SignalName } from '../../src/program/types';

/** Answers that a step's own copy invites must pass its check. */

function stepById(id: string): Step {
  const step = course.flatMap((l) => l.steps).find((s) => s.id === id);
  if (step === undefined) throw new Error(`no step ${id}`);
  return step;
}

/** The program with each layer's modifiers rewritten (or dropped, on null). */
function mapMods(p: Program, f: (m: Modifier) => Modifier | null): Program {
  return {
    ...p,
    layers: p.layers.map((l) => ({
      ...l,
      mods: l.mods.flatMap((m) => {
        const next = f(m);
        return next === null ? [] : [next];
      }),
    })),
  };
}

/** Changes the wave plugged into the filter cutoff. */
function lpfWave(p: Program, signal: SignalName, slow: number): Program {
  return mapMods(p, (m) =>
    'arg' in m && m.name === 'lpf' && m.arg.kind === 'signal'
      ? { ...m, arg: { ...m.arg, signal, slow } }
      : m,
  );
}

async function verdict(stepId: string, p: Program): Promise<{ pass: boolean; reason: string }> {
  return runCheck(stepById(stepId).check, await buildContext(p, true));
}

describe('m2-acidline-build', () => {
  const capstone = stepById('m2-acidline-build').solution;

  it('accepts the goal line moved by its sweep alone (no filter envelope)', async () => {
    const sweepOnly = mapMods(capstone, (m) => (m.name === 'lpenv' ? null : m));
    expect(sweepOnly.layers[0]?.mods.some((m) => m.name === 'lpenv')).toBe(false);
    const result = await verdict('m2-acidline-build', sweepOnly);
    expect(result.pass, result.reason).toBe(true);
  });
});

describe('m2-move-slow', () => {
  const solution = stepById('m2-move-slow').solution;

  it('accepts a much slower sine sweep (64 cycles)', async () => {
    const result = await verdict('m2-move-slow', lpfWave(solution, 'sine', 64));
    expect(result.pass, result.reason).toBe(true);
  });

  it('accepts a square wave over 8 cycles', async () => {
    const result = await verdict('m2-move-slow', lpfWave(solution, 'square', 8));
    expect(result.pass, result.reason).toBe(true);
  });

  it('still rejects a sweep faster than 8 cycles', async () => {
    const result = await verdict('m2-move-slow', lpfWave(solution, 'sine', 4));
    expect(result.pass).toBe(false);
  });
});
