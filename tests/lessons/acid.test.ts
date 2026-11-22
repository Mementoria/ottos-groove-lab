// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildContext, runCheck } from '../../src/checkers/checks';
import type { Check } from '../../src/checkers/checks';
import { course } from '../../src/lessons/content';
import type { Step } from '../../src/lessons/types';
import { bank, grid, layer, program } from '../../src/program/build';

function stepById(id: string): Step {
  const step = course.flatMap((l) => l.steps).find((s) => s.id === id);
  if (step === undefined) throw new Error(`no step ${id}`);
  return step;
}

describe('acid-squelch', () => {
  // The Module 2 capstone's own acid line: 16 saw notes, a sine sweep of 200–1000 over 8 cycles,
  // lpq 15, ladder and lpenv 3. In the 4-cycle check window that sweep only covers 600–1000.
  const capstone = stepById('m2-acidline-build').solution;
  const capstoneBass = capstone.layers[0];
  const kick = layer(grid('bd', [0, 4, 8, 12]), bank('RolandTR909'));

  it('accepts the sweep the Module 2 capstone taught', async () => {
    if (capstoneBass === undefined) throw new Error('capstone has no layer');
    const carried = program(128, kick, capstoneBass);
    const result = runCheck(stepById('acid-squelch').check, await buildContext(carried, true));
    expect(result.pass, result.reason).toBe(true);
  });

  it('needs the program-level range for it: the onset window alone is too narrow', async () => {
    if (capstoneBass === undefined) throw new Error('capstone has no layer');
    const carried = program(128, kick, capstoneBass);
    const windowOnly: Check = {
      kind: 'controlVaries',
      control: 'lpf',
      where: { s: 'sawtooth' },
      cycles: 4,
      minSpread: 500,
    };
    expect(runCheck(windowOnly, await buildContext(carried, true)).pass).toBe(false);
  });
});
