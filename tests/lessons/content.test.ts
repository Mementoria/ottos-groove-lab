// @vitest-environment node
import * as Blockly from 'blockly';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileForCheck } from '../../src/audio/compile';
import { registerBlocks } from '../../src/blocks/blockTypes';
import type { BlockType } from '../../src/blocks/blockTypes';
import { programToWorkspaceState, workspaceToProgram } from '../../src/blocks/convert';
import { buildContext, runCheck } from '../../src/checkers/checks';
import type { Check } from '../../src/checkers/checks';
import { toCheckExpression } from '../../src/program/codegen';
import type { Program } from '../../src/program/types';
import { course, unlockedFor } from '../../src/lessons/content';
import type { Step } from '../../src/lessons/types';

type BlockState = Blockly.serialization.blocks.State;

const EMPTY: Program = { bpm: null, layers: [] };

beforeAll(() => {
  registerBlocks();
});

/** Every block type in a program's workspace state, ignoring number shadows. */
function blockTypesOf(p: Program): Set<BlockType> {
  const types = new Set<BlockType>();
  const walk = (b: BlockState | undefined): void => {
    if (b === undefined) return;
    if (b.type !== 'math_number') types.add(b.type);
    for (const input of Object.values(b.inputs ?? {})) {
      walk(input.block);
      walk(input.shadow);
    }
    walk(b.next?.block);
  };
  for (const b of programToWorkspaceState(p).blocks.blocks) walk(b);
  return types;
}

function stripIds(p: Program): unknown {
  return JSON.parse(
    JSON.stringify(p, (key: string, value: unknown) => (key === 'id' ? undefined : value)),
  );
}

function roundTrip(p: Program): { program: Program; warnings: number } {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(programToWorkspaceState(p), ws);
    const { program, warnings } = workspaceToProgram(ws);
    return { program, warnings: warnings.length };
  } finally {
    ws.dispose();
  }
}

function emptyCompoundChecks(check: Check): string[] {
  if (check.kind !== 'all' && check.kind !== 'any') return [];
  const nested = check.checks.flatMap(emptyCompoundChecks);
  return check.checks.length === 0 ? [check.kind, ...nested] : nested;
}

function programsOf(step: Step): [string, Program][] {
  const named: [string, Program | undefined][] = [
    ['start', step.start],
    ['solution', step.solution],
    ['target', step.target],
  ];
  return named.filter((entry): entry is [string, Program] => entry[1] !== undefined);
}

/**
 * Steps that must not pass on entry: puzzles, and guided steps with an automatic check other
 * than "playing" (one that passed at once would auto-complete and swallow its intro).
 */
function mustFailAtStart(step: Step): boolean {
  if (step.type === 'puzzle') return true;
  return step.type === 'guided' && step.check.kind !== 'playing' && step.check.kind !== 'manual';
}

describe('mustFailAtStart', () => {
  const base: Step = {
    id: 'x',
    label: 'x',
    type: 'guided',
    say: [],
    check: { kind: 'layers', min: 1 },
    hints: [{ say: 'a' }, { say: 'b' }],
    solution: EMPTY,
    success: 'ok',
  };

  it('covers puzzles and guided steps with an automatic, non-playing check', () => {
    expect(mustFailAtStart({ ...base, type: 'puzzle' })).toBe(true);
    expect(mustFailAtStart(base)).toBe(true);
    expect(mustFailAtStart({ ...base, check: { kind: 'playing' } })).toBe(false);
    expect(mustFailAtStart({ ...base, check: { kind: 'manual' } })).toBe(false);
    expect(mustFailAtStart({ ...base, type: 'open' })).toBe(false);
  });
});

describe('content harness', () => {
  it('has unique step ids across the course', () => {
    const ids = course.flatMap((l) => l.steps.map((s) => s.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('accumulates unlocks without duplicates', () => {
    for (let i = 0; i < course.length; i += 1) {
      const unlocked = unlockedFor(i);
      expect(new Set(unlocked).size).toBe(unlocked.length);
      for (const type of course[i]?.unlocks ?? []) expect(unlocked).toContain(type);
    }
  });

  course.forEach((lesson, lessonIndex) => {
    describe(lesson.id, () => {
      const unlocked = unlockedFor(lessonIndex);

      lesson.steps.forEach((step, stepIndex) => {
        const previous = lesson.steps[stepIndex - 1] ?? course[lessonIndex - 1]?.steps.at(-1);
        const effectiveStart = step.start ?? previous?.solution ?? EMPTY;

        describe(step.id, () => {
          it('has no empty all/any check', () => {
            expect(emptyCompoundChecks(step.check)).toEqual([]);
          });

          it('solution passes its check', async () => {
            if (step.check.kind === 'manual') return;
            const ctx = await buildContext(step.solution, true);
            const result = runCheck(step.check, ctx);
            expect(result.pass, result.reason).toBe(true);
          });

          it('start fails its check (puzzles, and guided steps a learner must act on)', async () => {
            if (!mustFailAtStart(step)) return;
            const ctx = await buildContext(effectiveStart, true);
            expect(runCheck(step.check, ctx).pass).toBe(false);
          });

          it('solution and start use only unlocked blocks', () => {
            for (const [name, p] of programsOf(step)) {
              const locked = [...blockTypesOf(p)].filter((t) => !unlocked.includes(t));
              expect(locked, name).toEqual([]);
            }
          });

          it('hint highlights use only unlocked blocks', () => {
            for (const hint of step.hints) {
              const locked = (hint.highlight?.blockTypes ?? []).filter(
                (t) => !unlocked.includes(t),
              );
              expect(locked).toEqual([]);
            }
          });

          it('target compiles', async () => {
            if (step.target === undefined) return;
            await expect(compileForCheck(toCheckExpression(step.target))).resolves.toBeDefined();
          });

          it('programs round-trip through blocks unchanged, without warnings', () => {
            for (const [name, p] of programsOf(step)) {
              const result = roundTrip(p);
              expect(result.warnings, name).toBe(0);
              expect(stripIds(result.program), name).toEqual(stripIds(p));
            }
          });
        });
      });
    });
  });
});
