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

declare module '@strudel/soundfonts' {
  export function registerSoundfonts(): Promise<void>;
}

declare module '@strudel/web' {
  import type { Pattern } from '@strudel/core';

  export interface EvalMeta {
    miniLocations?: [number, number][];
  }

  export interface StrudelRepl {
    evaluate(code: string, autostart?: boolean): Promise<Pattern | undefined>;
    stop(): void;
    scheduler: { now(): number };
  }

  export interface StrudelOptions {
    prebake?: () => Promise<void>;
    afterEval?: (info: { code: string; pattern: Pattern; meta: EvalMeta | undefined }) => void;
  }

  export interface SuperdoughAudioController {
    output: { destinationGain: AudioNode };
  }

  export function initStrudel(options?: StrudelOptions): Promise<StrudelRepl>;
  export function initAudio(): Promise<void>;
  export function samples(source: string): Promise<void>;
  export function getAudioContext(): AudioContext;
  export function getSuperdoughAudioController(): SuperdoughAudioController;
}
