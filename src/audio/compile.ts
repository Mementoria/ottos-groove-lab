import * as core from '@strudel/core';
import type { Pattern } from '@strudel/core';
import * as mini from '@strudel/mini';
import { transpiler } from '@strudel/transpiler';

export type { Pattern };

export interface Onset {
  cycle: number;
  /** Position on the 16th-note grid within the cycle, or null if off-grid. */
  step16: number | null;
  value: Record<string, unknown>;
}

interface CheckScope {
  names: string[];
  values: unknown[];
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** Not usable as parameter names in strict-mode code. */
const RESERVED = new Set(['eval', 'arguments', 'default']);

let checkScope: CheckScope | undefined;

/**
 * The check vocabulary as explicit parameters. Deliberately not `evalScope`: that writes every
 * export onto globalThis, where @strudel/web's own (bundled) copy of core lives for playback.
 * Overwriting it there breaks playback (its `$:` needs that copy's Pattern methods).
 *
 * This separate copy of @strudel/core is why the console warns that "@strudel/core was loaded
 * more than once" when a lesson opens. That is intended: the two copies never share state.
 */
function ensureScope(): CheckScope {
  // @strudel/tonal is intentionally left out: checks don't need it until Module 4.
  if (checkScope) return checkScope;
  const scope = new Map<string, unknown>();
  for (const mod of [core, mini]) {
    for (const [name, value] of Object.entries(mod as object) as [string, unknown][]) {
      if (IDENTIFIER.test(name) && !RESERVED.has(name)) scope.set(name, value);
    }
  }
  checkScope = { names: [...scope.keys()], values: [...scope.values()] };
  return checkScope;
}

// Async on purpose: a parse error in a pattern then arrives as a rejection, as callers expect.
// eslint-disable-next-line @typescript-eslint/require-await
export async function compileForCheck(expression: string): Promise<Pattern> {
  const { names, values } = ensureScope();
  const { output } = transpiler(expression, {
    wrapAsync: false,
    addReturn: true,
    emitMiniLocations: false,
    emitWidgets: false,
  });
  // The transpiled body only refers to names in the scope (it is our own generated code).
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function(...names, `"use strict";\n${output}`) as (...args: unknown[]) => Pattern;
  return run(...values);
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
