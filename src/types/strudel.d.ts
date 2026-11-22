// Hand-written declarations for the untyped Strudel packages.
// Keep these narrow: only what the app actually uses, typed with `unknown`.

declare module '@strudel/core' {
  export interface Fraction {
    sub(amount: number): Fraction;
    mul(factor: number): Fraction;
    mod(divisor: number): Fraction;
    valueOf(): number;
  }

  export interface Hap {
    whole: { begin: Fraction; end: Fraction } | undefined;
    value: Record<string, unknown>;
    hasOnset(): boolean;
  }

  export interface Pattern {
    queryArc(begin: number, end: number): Hap[];
  }

  export function evalScope(...modules: Promise<unknown>[]): Promise<unknown[]>;
}

declare module '@strudel/mini' {
  const mini: unknown;
  export = mini;
}

declare module '@strudel/tonal' {
  const tonal: unknown;
  export = tonal;
}

declare module '@strudel/transpiler' {
  import type { Pattern } from '@strudel/core';
  export function evaluate(code: string): Promise<{ pattern: Pattern; meta: unknown }>;
}
