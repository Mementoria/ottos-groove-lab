import type { Layer, Modifier, NumArg, Program, Source } from './types';

export interface Generated {
  code: string;
  spans: Record<string, [from: number, to: number]>;
}

const BEAT_SIZE = 4;

export function gridToMini(sound: string, steps: boolean[]): string {
  const beats: string[] = [];
  for (let i = 0; i < steps.length; i += BEAT_SIZE) {
    const cells = steps.slice(i, i + BEAT_SIZE).map((on) => (on ? sound : '~'));
    beats.push(cells.every((c) => c === '~') ? '~' : `[${cells.join(' ')}]`);
  }
  return beats.join(' ');
}

function sourceMini(source: Source): string {
  return source.kind === 'grid' ? gridToMini(source.sound, source.steps) : source.mini;
}

function sourceCall(source: Source): string {
  const fn = source.kind === 'notes' ? 'note' : 's';
  return `${fn}(${JSON.stringify(sourceMini(source))})`;
}

function numArg(arg: NumArg): string {
  if (arg.kind === 'number') return String(arg.value);
  return `${arg.signal}.range(${String(arg.min)}, ${String(arg.max)}).slow(${String(arg.slow)})`;
}

function modCall(m: Modifier): string {
  const arg = 'arg' in m ? numArg(m.arg) : JSON.stringify(m.value);
  return `.${m.name}(${arg})`;
}

/** Whether a layer has anything to play (codegen drops a blank pattern). */
export function isRenderable(l: Layer): boolean {
  return l.source.kind === 'grid' || l.source.mini.trim() !== '';
}

export function toStrudelCode(p: Program): Generated {
  const spans: Generated['spans'] = {};
  let code = '';
  const append = (text: string, id?: string): void => {
    if (id !== undefined) spans[id] = [code.length, code.length + text.length];
    code += text;
  };

  if (p.bpm !== null) append(`setcpm(${String(p.bpm)}/4)\n`);

  p.layers.filter(isRenderable).forEach((l, index) => {
    if (index > 0 || p.bpm !== null) append('\n');
    // The layer's span is its `$:` line: touching (or pointing at) an arm glows it.
    const lineStart = code.length;
    append(l.muted ? '_$: ' : '$: ');
    append(sourceCall(l.source), l.source.id);
    spans[l.id] = [lineStart, code.length];
    append('\n');
    for (const m of l.mods) {
      append('  ');
      append(modCall(m), m.id);
      append('\n');
    }
  });

  return { code, spans };
}

/** One layer as a single expression: its source call with the modifiers chained on. */
export function layerExpression(l: Layer): string {
  return sourceCall(l.source) + l.mods.map(modCall).join('');
}

export function toCheckExpression(p: Program): string {
  const layers = p.layers.filter((l) => !l.muted && isRenderable(l)).map(layerExpression);
  return layers.length === 0 ? 'silence' : `stack(${layers.join(', ')})`;
}
