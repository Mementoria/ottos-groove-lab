export type Oscillator = 'sawtooth' | 'square' | 'triangle' | 'sine';
export type SignalName = 'sine' | 'saw' | 'square' | 'tri' | 'perlin';
export type NumArg =
  | { kind: 'number'; value: number }
  | { kind: 'signal'; signal: SignalName; min: number; max: number; slow: number };
export type NumericModName =
  | 'fast'
  | 'slow'
  | 'gain'
  | 'pan'
  | 'lpf'
  | 'lpq'
  | 'hpf'
  | 'lpenv'
  | 'lpa'
  | 'lpd'
  | 'lps'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'delay'
  | 'room'
  | 'distort';
export type Modifier =
  | { id: string; name: NumericModName; arg: NumArg }
  | { id: string; name: 's'; value: Oscillator }
  | { id: string; name: 'bank'; value: 'RolandTR909' | 'RolandTR808' }
  | { id: string; name: 'ftype'; value: '12db' | '24db' | 'ladder' };
export type Source =
  | { id: string; kind: 'sound'; mini: string }
  | { id: string; kind: 'notes'; mini: string }
  | { id: string; kind: 'grid'; sound: string; steps: boolean[] };
export interface Layer {
  id: string;
  muted: boolean;
  source: Source;
  mods: Modifier[];
}
export interface Program {
  bpm: number | null;
  layers: Layer[];
}
