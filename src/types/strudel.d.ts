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
  export interface TranspilerOptions {
    wrapAsync?: boolean;
    addReturn?: boolean;
    emitMiniLocations?: boolean;
    emitWidgets?: boolean;
  }
  /** Rewrites Strudel code (mini-notation strings, `$:` labels) into plain JavaScript. */
  export function transpiler(input: string, options?: TranspilerOptions): { output: string };
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

// Deep import: just the mini-notation highlighting, without the whole @strudel/codemirror REPL.
declare module '@strudel/codemirror/highlight.mjs' {
  import type { Extension } from '@codemirror/state';
  import type { EditorView } from '@codemirror/view';
  import type { Hap } from '@strudel/core';

  /** State fields + decorations that outline the mini-notation source of the active haps. */
  export const highlightExtension: Extension;
  /** Call on each evaluation with the transpiler's mini-notation locations ([from, to] offsets). */
  export function updateMiniLocations(
    view: EditorView,
    locations: readonly (readonly [number, number])[],
  ): void;
  /**
   * Call each frame with the haps active now. Haps without `whole` or `context.locations`
   * (which every hap from an evaluated pattern carries) are ignored.
   */
  export function highlightMiniLocations(
    view: EditorView,
    atTime: number,
    haps: readonly Hap[],
  ): void;
}
