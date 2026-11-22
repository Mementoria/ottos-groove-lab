import { evalScope } from '@strudel/core';
import type { Pattern } from '@strudel/core';
import { evaluate } from '@strudel/transpiler';

export type { Pattern };

export interface Onset {
  cycle: number;
  /** Position on the 16th-note grid within the cycle, or null if off-grid. */
  step16: number | null;
  value: Record<string, unknown>;
}

let scopeReady: Promise<unknown> | undefined;

function ensureScope(): Promise<unknown> {
  // @strudel/tonal is intentionally left out: checks don't need it until Module 4.
  scopeReady ??= evalScope(import('@strudel/core'), import('@strudel/mini'));
  return scopeReady;
}

export async function compileForCheck(expression: string): Promise<Pattern> {
  await ensureScope();
  const { pattern } = await evaluate(expression);
  return pattern;
}

export function onsets(p: Pattern, cycles: number): Onset[] {
  const result: Onset[] = [];
  for (const hap of p.queryArc(0, cycles)) {
    if (!hap.hasOnset() || hap.whole === undefined) continue;
    const begin = hap.whole.begin;
    const cycle = Math.floor(begin.valueOf());
    // Exact rational arithmetic (fraction.js): the onset is on the 16th grid iff
    // (begin - cycle) * 16 has no fractional part, so no float tolerance is needed.
    const scaled = begin.sub(cycle).mul(16);
    const step16 = scaled.mod(1).valueOf() === 0 ? scaled.valueOf() : null;
    result.push({ cycle, step16, value: hap.value });
  }
  return result;
}
