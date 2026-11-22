import { compileForCheck, onsets } from '../audio/compile';
import type { Onset } from '../audio/compile';
import type { Program } from '../program/types';
import { toCheckExpression } from '../program/codegen';

export type Where = { s?: string; bank?: string };

export type Check =
  | { kind: 'manual' }
  | { kind: 'playing' }
  | { kind: 'all'; checks: Check[] }
  | { kind: 'any'; checks: Check[] }
  | { kind: 'layers'; min: number }
  | { kind: 'tempo'; bpm: number; tolerance: number }
  | { kind: 'onsetsPerCycle'; where: Where; count: number }
  | { kind: 'onsetsAt'; where: Where; steps: number[] }
  | { kind: 'hasSound'; s: string }
  | { kind: 'distinctNotes'; min: number }
  | {
      kind: 'control';
      control: string;
      where?: Where;
      min?: number;
      max?: number;
      equals?: string | number;
    }
  | { kind: 'controlVaries'; control: string; where?: Where; cycles: number; minSpread: number }
  /** Reads the program: an unmuted layer drives `control` (a method name) with a signal this slow. */
  | { kind: 'signalSlow'; control: string; min: number }
  /** Reads the program: an unmuted layer drives `control` (a method name) with a signal this wide. */
  | { kind: 'signalRange'; control: string; minSpread: number };

export interface CheckContext {
  program: Program;
  /** Onsets over the first four cycles. */
  onsets: Onset[];
  playing: boolean;
}

export interface CheckResult {
  pass: boolean;
  reason: string;
}

const WINDOW_CYCLES = 4;

const CONTROL_KEYS: Record<string, string> = {
  lpf: 'cutoff',
  lpq: 'resonance',
  hpf: 'hcutoff',
  lpa: 'lpattack',
  lpd: 'lpdecay',
  lps: 'lpsustain',
};

/** Check data uses method names; hap values use canonical control keys. */
export function controlKey(method: string): string {
  return CONTROL_KEYS[method] ?? method;
}

function matches(o: Onset, where: Where | undefined): boolean {
  if (where === undefined) return true;
  return Object.entries(where).every(([key, expected]) => o.value[key] === expected);
}

function outcome(pass: boolean, reason: string): CheckResult {
  return { pass, reason };
}

function numeric(o: Onset, key: string): number | undefined {
  const v = o.value[key];
  return typeof v === 'number' ? v : undefined;
}

type Of<K extends Check['kind']> = Extract<Check, { kind: K }>;

function runControl(check: Of<'control'>, ctx: CheckContext): CheckResult {
  const key = controlKey(check.control);
  const having = ctx.onsets.filter((o) => matches(o, check.where) && o.value[key] !== undefined);
  if (having.length === 0) return outcome(false, `no onset has ${key}`);
  for (const o of having) {
    const v = o.value[key];
    if (check.equals !== undefined && v !== check.equals) {
      return outcome(false, `${key} is ${String(v)}, expected ${String(check.equals)}`);
    }
    if (check.min !== undefined || check.max !== undefined) {
      if (typeof v !== 'number') return outcome(false, `${key} is not a number`);
      if (check.min !== undefined && v < check.min) {
        return outcome(false, `${key} ${String(v)} is below ${String(check.min)}`);
      }
      if (check.max !== undefined && v > check.max) {
        return outcome(false, `${key} ${String(v)} is above ${String(check.max)}`);
      }
    }
  }
  return outcome(true, `${key} ok`);
}

function runControlVaries(check: Of<'controlVaries'>, ctx: CheckContext): CheckResult {
  const key = controlKey(check.control);
  const values = ctx.onsets
    .filter((o) => o.cycle < check.cycles && matches(o, check.where))
    .map((o) => numeric(o, key))
    .filter((v): v is number => v !== undefined);
  if (values.length === 0) return outcome(false, `no numeric ${key} values`);
  const spread = Math.max(...values) - Math.min(...values);
  return outcome(
    spread >= check.minSpread,
    `${key} spread ${String(spread)} vs needed ${String(check.minSpread)}`,
  );
}

function runSignalSlow(check: Of<'signalSlow'>, ctx: CheckContext): CheckResult {
  const slows = ctx.program.layers
    .filter((l) => !l.muted)
    .flatMap((l) => l.mods)
    .flatMap((m) =>
      'arg' in m && m.name === check.control && m.arg.kind === 'signal' ? [m.arg.slow] : [],
    );
  if (slows.length === 0) return outcome(false, `no wave plugged into ${check.control}`);
  const slowest = Math.max(...slows);
  return outcome(
    slowest >= check.min,
    `${check.control} wave over ${String(slowest)} cycles, need ${String(check.min)}`,
  );
}

function runSignalRange(check: Of<'signalRange'>, ctx: CheckContext): CheckResult {
  const spreads = ctx.program.layers
    .filter((l) => !l.muted)
    .flatMap((l) => l.mods)
    .flatMap((m) =>
      'arg' in m && m.name === check.control && m.arg.kind === 'signal'
        ? [Math.abs(m.arg.max - m.arg.min)]
        : [],
    );
  if (spreads.length === 0) return outcome(false, `no wave plugged into ${check.control}`);
  const widest = Math.max(...spreads);
  return outcome(
    widest >= check.minSpread,
    `${check.control} wave spans ${String(widest)}, need ${String(check.minSpread)}`,
  );
}

export function runCheck(check: Check, ctx: CheckContext): CheckResult {
  switch (check.kind) {
    case 'manual':
      return outcome(false, 'manual step');
    case 'playing':
      return outcome(ctx.playing, ctx.playing ? 'playing' : 'not playing');
    case 'all': {
      for (const c of check.checks) {
        const r = runCheck(c, ctx);
        if (!r.pass) return r;
      }
      return outcome(true, 'all passed');
    }
    case 'any': {
      const reasons: string[] = [];
      for (const c of check.checks) {
        const r = runCheck(c, ctx);
        if (r.pass) return r;
        reasons.push(r.reason);
      }
      return outcome(false, `none passed: ${reasons.join('; ')}`);
    }
    case 'layers': {
      const n = ctx.program.layers.length;
      return outcome(n >= check.min, `${String(n)} layers, need ${String(check.min)}`);
    }
    case 'tempo': {
      const bpm = ctx.program.bpm;
      if (bpm === null) return outcome(false, 'no tempo set');
      return outcome(
        Math.abs(bpm - check.bpm) <= check.tolerance,
        `bpm ${String(bpm)}, wanted ${String(check.bpm)} ± ${String(check.tolerance)}`,
      );
    }
    case 'onsetsPerCycle': {
      const n = ctx.onsets.filter((o) => o.cycle === 0 && matches(o, check.where)).length;
      return outcome(n === check.count, `${String(n)} onsets, wanted ${String(check.count)}`);
    }
    case 'onsetsAt': {
      const found = ctx.onsets
        .filter((o) => o.cycle === 0 && matches(o, check.where))
        .map((o) => o.step16);
      const actual = [...found].sort();
      const wanted = [...check.steps].sort();
      const same = actual.length === wanted.length && actual.every((s, i) => s === wanted[i]);
      return outcome(same, `steps [${actual.map(String).join(',')}], wanted [${wanted.join(',')}]`);
    }
    case 'hasSound': {
      const has = ctx.onsets.some((o) => o.value['s'] === check.s);
      return outcome(has, has ? `has ${check.s}` : `no ${check.s}`);
    }
    case 'distinctNotes': {
      const notes = new Set(ctx.onsets.map((o) => o.value['note']).filter((v) => v !== undefined));
      return outcome(
        notes.size >= check.min,
        `${String(notes.size)} distinct notes, need ${String(check.min)}`,
      );
    }
    case 'control':
      return runControl(check, ctx);
    case 'controlVaries':
      return runControlVaries(check, ctx);
    case 'signalSlow':
      return runSignalSlow(check, ctx);
    case 'signalRange':
      return runSignalRange(check, ctx);
  }
}

export async function buildContext(program: Program, playing: boolean): Promise<CheckContext> {
  const pattern = await compileForCheck(toCheckExpression(program));
  return { program, onsets: onsets(pattern, WINDOW_CYCLES), playing };
}
