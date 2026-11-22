import type {
  Layer,
  Modifier,
  NumArg,
  NumericModName,
  Oscillator,
  Program,
  SignalName,
  Source,
} from './types';

const GRID_STEPS = 16;

let counter = 0;

function nextId(kind: string): string {
  counter += 1;
  return `${kind}-${String(counter)}`;
}

export function program(bpm: number | null, ...layers: Layer[]): Program {
  return { bpm, layers };
}

export function layer(source: Source, ...mods: Modifier[]): Layer {
  return { id: nextId('layer'), muted: false, source, mods };
}

export function muted(l: Layer): Layer {
  return { ...l, muted: true };
}

export function sound(mini: string): Source {
  return { id: nextId('sound'), kind: 'sound', mini };
}

export function notes(mini: string): Source {
  return { id: nextId('notes'), kind: 'notes', mini };
}

export function grid(soundName: string, hits: number[]): Source {
  const steps = Array.from({ length: GRID_STEPS }, (_, i) => hits.includes(i));
  return { id: nextId('grid'), kind: 'grid', sound: soundName, steps };
}

export function mod(name: NumericModName, arg: number | NumArg): Modifier {
  return {
    id: nextId(name),
    name,
    arg: typeof arg === 'number' ? { kind: 'number', value: arg } : arg,
  };
}

export function osc(o: Oscillator): Modifier {
  return { id: nextId('s'), name: 's', value: o };
}

export function bank(b: 'RolandTR909' | 'RolandTR808'): Modifier {
  return { id: nextId('bank'), name: 'bank', value: b };
}

export function ftype(f: '12db' | '24db' | 'ladder'): Modifier {
  return { id: nextId('ftype'), name: 'ftype', value: f };
}

export function signal(signalName: SignalName, min: number, max: number, slow: number): NumArg {
  return { kind: 'signal', signal: signalName, min, max, slow };
}
