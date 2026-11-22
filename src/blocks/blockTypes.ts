import * as Blockly from 'blockly';
import type { NumericModName } from '../program/types';
import { FieldStepGrid, STEP_GRID_CSS } from './FieldStepGrid';
import { CATEGORY_COLOURS, type Category } from './theme';

export const BT = {
  layer: 'ogl_layer',
  tempo: 'ogl_tempo',
  sound: 'ogl_sound',
  notes: 'ogl_notes',
  grid: 'ogl_grid',
  osc: 'ogl_osc',
  bank: 'ogl_bank',
  ftype: 'ogl_ftype',
  signal: 'ogl_signal',
} as const;

/** A `BT` value or `ogl_mod_${NumericModName}`. */
export type BlockType = string;

const MOD_PREFIX = 'ogl_mod_';

export function modBlockType(name: NumericModName): BlockType {
  return `${MOD_PREFIX}${name}`;
}

interface NumericModInfo {
  /** The friendly musical name shown first on the block. */
  label: string;
  /** The value a fresh block from the palette starts with. */
  initial: number;
  category: Category;
  tooltip: string;
}

/** Every numeric modifier, in palette order within its category. */
export const NUMERIC_MODS: Record<NumericModName, NumericModInfo> = {
  gain: { label: 'volume', initial: 0.8, category: 'Sounds', tooltip: 'How loud this arm plays.' },
  pan: { label: 'pan', initial: 0.5, category: 'Sounds', tooltip: 'Left (0) to right (1).' },
  lpf: {
    label: 'filter cutoff',
    initial: 800,
    category: 'Filter',
    tooltip: 'Low-pass filter: cuts the highs above this frequency, in Hz.',
  },
  lpq: {
    label: 'resonance',
    initial: 5,
    category: 'Filter',
    tooltip: 'Boosts the sound right at the filter cutoff.',
  },
  hpf: {
    label: 'high-pass',
    initial: 200,
    category: 'Filter',
    tooltip: 'High-pass filter: cuts the lows below this frequency, in Hz.',
  },
  lpenv: {
    label: 'filter envelope',
    initial: 4,
    category: 'Filter',
    tooltip: 'How far each note sweeps the filter cutoff.',
  },
  lpa: {
    label: 'filter attack',
    initial: 0.01,
    category: 'Filter',
    tooltip: 'Seconds for the filter sweep to rise.',
  },
  lpd: {
    label: 'filter decay',
    initial: 0.2,
    category: 'Filter',
    tooltip: 'Seconds for the filter sweep to fall back.',
  },
  lps: {
    label: 'filter sustain',
    initial: 0,
    category: 'Filter',
    tooltip: 'Where the filter sweep settles, from 0 to 1.',
  },
  attack: {
    label: 'attack',
    initial: 0.01,
    category: 'Envelope',
    tooltip: 'Seconds for each note to fade in.',
  },
  decay: {
    label: 'decay',
    initial: 0.2,
    category: 'Envelope',
    tooltip: 'Seconds for each note to fall to its sustain level.',
  },
  sustain: {
    label: 'sustain',
    initial: 0.5,
    category: 'Envelope',
    tooltip: 'How loud a held note stays, from 0 to 1.',
  },
  release: {
    label: 'release',
    initial: 0.3,
    category: 'Envelope',
    tooltip: 'Seconds for each note to fade out.',
  },
  delay: {
    label: 'echo',
    initial: 0.25,
    category: 'Effects',
    tooltip: 'How much echo, from 0 to 1.',
  },
  room: {
    label: 'reverb',
    initial: 0.5,
    category: 'Effects',
    tooltip: 'How much room reverb, from 0 to 1.',
  },
  distort: {
    label: 'grit',
    initial: 0.5,
    category: 'Effects',
    tooltip: 'Distortion: adds crunch and grit.',
  },
  fast: {
    label: 'faster',
    initial: 2,
    category: 'Time',
    tooltip: 'Plays the pattern this many times faster.',
  },
  slow: {
    label: 'slower',
    initial: 2,
    category: 'Time',
    tooltip: 'Plays the pattern this many times slower.',
  },
};

export function isNumericModName(name: string): name is NumericModName {
  return Object.hasOwn(NUMERIC_MODS, name);
}

/** The numeric modifier a block type stands for, or null if it isn't one. */
export function numericModOf(type: BlockType): NumericModName | null {
  if (!type.startsWith(MOD_PREFIX)) return null;
  const name = type.slice(MOD_PREFIX.length);
  return isNumericModName(name) ? name : null;
}

export const OSCILLATOR_OPTIONS = [
  ['sawtooth', 'sawtooth'],
  ['square', 'square'],
  ['triangle', 'triangle'],
  ['sine', 'sine'],
] as const;
export const BANK_OPTIONS = [
  ['TR-909', 'RolandTR909'],
  ['TR-808', 'RolandTR808'],
] as const;
export const FTYPE_OPTIONS = [
  ['12db', '12db'],
  ['24db', '24db'],
  ['ladder', 'ladder'],
] as const;
export const SIGNAL_OPTIONS = [
  ['sine', 'sine'],
  ['saw', 'saw'],
  ['square', 'square'],
  ['triangle', 'tri'],
  ['perlin', 'perlin'],
] as const;

/** Which palette category each block belongs to, in palette order. */
export const BLOCK_CATEGORIES: readonly (readonly [BlockType, Category])[] = [
  [BT.layer, 'Layers'],
  [BT.sound, 'Sounds'],
  [BT.grid, 'Sounds'],
  [BT.osc, 'Sounds'],
  [BT.bank, 'Sounds'],
  [modBlockType('gain'), 'Sounds'],
  [modBlockType('pan'), 'Sounds'],
  [BT.notes, 'Notes'],
  [modBlockType('lpf'), 'Filter'],
  [modBlockType('lpq'), 'Filter'],
  [modBlockType('hpf'), 'Filter'],
  [BT.ftype, 'Filter'],
  [modBlockType('lpenv'), 'Filter'],
  [modBlockType('lpa'), 'Filter'],
  [modBlockType('lpd'), 'Filter'],
  [modBlockType('lps'), 'Filter'],
  [modBlockType('attack'), 'Envelope'],
  [modBlockType('decay'), 'Envelope'],
  [modBlockType('sustain'), 'Envelope'],
  [modBlockType('release'), 'Envelope'],
  [BT.signal, 'Movement'],
  [modBlockType('delay'), 'Effects'],
  [modBlockType('room'), 'Effects'],
  [modBlockType('distort'), 'Effects'],
  [BT.tempo, 'Time'],
  [modBlockType('fast'), 'Time'],
  [modBlockType('slow'), 'Time'],
];

export const DEFAULT_GRID_STEPS = 'x...x...x...x...';
export const DEFAULT_SIGNAL = { signal: 'sine', min: 200, max: 2000, slow: 4 } as const;

/** Rejects characters that would break out of a quoted Strudel string. */
export function validateMini(value: string): string | null {
  return /["\\]/.test(value) ? null : value;
}

/** A drum sound must be a single sample name, e.g. `bd` or `bd:3`. */
export function validateSoundName(value: string): string | null {
  return /^[^\s"\\]+$/.test(value) ? value : null;
}

const EXT_HAT = 'ogl_hat';
const EXT_MINI = 'ogl_validate_mini';
const EXT_SOUND = 'ogl_validate_sound';

type BlockJson = Record<string, unknown> & { type: BlockType };

function colourOf(type: BlockType): string {
  const entry = BLOCK_CATEGORIES.find(([t]) => t === type);
  if (entry === undefined) throw new Error(`No category for block ${type}`);
  return CATEGORY_COLOURS[entry[1]];
}

function strudelName(name: string): Record<string, unknown> {
  return { type: 'field_label', text: `· ${name}`, class: 'ogl-strudel-name' };
}

function chainBlock(json: BlockJson): BlockJson {
  return { previousStatement: null, nextStatement: null, colour: colourOf(json.type), ...json };
}

function numericModBlock(name: NumericModName): BlockJson {
  const info = NUMERIC_MODS[name];
  const value = { type: 'input_value', name: 'VALUE', check: ['Number', 'Signal'] };
  const labelled = info.label !== name;
  return chainBlock({
    type: modBlockType(name),
    message0: labelled ? `${info.label} %1 %2` : `${info.label} %1`,
    args0: labelled ? [strudelName(name), value] : [value],
    inputsInline: true,
    tooltip: info.tooltip,
  });
}

function dropdown(name: string, options: readonly (readonly [string, string])[]) {
  return { type: 'field_dropdown', name, options: options.map(([label, value]) => [label, value]) };
}

function blockDefinitions(): BlockJson[] {
  const numericMods = BLOCK_CATEGORIES.map(([type]) => numericModOf(type)).filter(
    (name) => name !== null,
  );
  return [
    {
      type: BT.layer,
      message0: '🐙 arm %1 mute',
      args0: [{ type: 'field_checkbox', name: 'MUTED', checked: false }],
      nextStatement: null,
      colour: colourOf(BT.layer),
      tooltip: 'One of my arms. Put a sound or notes block under it, then shape it.',
      extensions: [EXT_HAT],
    },
    {
      type: BT.tempo,
      message0: 'tempo %1 BPM',
      args0: [{ type: 'field_number', name: 'BPM', value: 120, min: 20, max: 300, precision: 1 }],
      colour: colourOf(BT.tempo),
      tooltip: 'Beats per minute for the whole song.',
    },
    chainBlock({
      type: BT.sound,
      message0: 'play sound %1 %2',
      args0: [{ type: 'field_input', name: 'MINI', text: 'bd sd' }, strudelName('s')],
      tooltip: 'Plays samples in a pattern, like "bd sd hh".',
      extensions: [EXT_MINI],
    }),
    chainBlock({
      type: BT.notes,
      message0: 'play notes %1 %2',
      args0: [{ type: 'field_input', name: 'MINI', text: 'c3 e3 g3' }, strudelName('note')],
      tooltip: 'Plays notes in a pattern, like "c3 e3 g3".',
      extensions: [EXT_MINI],
    }),
    chainBlock({
      type: BT.grid,
      message0: 'drum %1 %2',
      args0: [
        { type: 'field_input', name: 'SOUND', text: 'bd' },
        { type: 'field_step_grid', name: 'STEPS', value: DEFAULT_GRID_STEPS },
      ],
      tooltip: 'Click the grid to choose which of the 16 steps hit.',
      extensions: [EXT_SOUND],
    }),
    chainBlock({
      type: BT.osc,
      message0: 'with sound %1 %2',
      args0: [dropdown('VALUE', OSCILLATOR_OPTIONS), strudelName('s')],
      tooltip: 'Which synth waveform plays the notes.',
    }),
    chainBlock({
      type: BT.bank,
      message0: 'drum machine %1 %2',
      args0: [dropdown('VALUE', BANK_OPTIONS), strudelName('bank')],
      tooltip: 'Which classic drum machine the samples come from.',
    }),
    chainBlock({
      type: BT.ftype,
      message0: 'filter type %1 %2',
      args0: [dropdown('VALUE', FTYPE_OPTIONS), strudelName('ftype')],
      tooltip: 'The character of the low-pass filter.',
    }),
    {
      type: BT.signal,
      message0: '%1 wave from %2 to %3 over %4 cycles',
      args0: [
        dropdown('SIGNAL', SIGNAL_OPTIONS),
        { type: 'field_number', name: 'MIN', value: DEFAULT_SIGNAL.min, min: -100000, max: 100000 },
        { type: 'field_number', name: 'MAX', value: DEFAULT_SIGNAL.max, min: -100000, max: 100000 },
        { type: 'field_number', name: 'SLOW', value: DEFAULT_SIGNAL.slow, min: 0.125, max: 256 },
      ],
      output: 'Signal',
      inputsInline: true,
      colour: colourOf(BT.signal),
      tooltip: 'A value that moves smoothly between two numbers. Drop it into a number slot.',
    },
    ...numericMods.map(numericModBlock),
  ];
}

function setFieldValidator(
  block: Blockly.Block,
  name: string,
  validator: (v: string) => string | null,
) {
  block.getField(name)?.setValidator(validator);
}

let cssRegistered = false;

/** Registers the step-grid field, extensions and every block. Safe to call more than once. */
export function registerBlocks(): void {
  if (!Blockly.registry.hasItem(Blockly.registry.Type.FIELD, 'field_step_grid')) {
    Blockly.fieldRegistry.register('field_step_grid', FieldStepGrid);
  }
  const extensions: [string, (this: Blockly.Block) => void][] = [
    [
      EXT_HAT,
      function (this: Blockly.Block) {
        this.hat = 'cap';
      },
    ],
    [
      EXT_MINI,
      function (this: Blockly.Block) {
        setFieldValidator(this, 'MINI', validateMini);
      },
    ],
    [
      EXT_SOUND,
      function (this: Blockly.Block) {
        setFieldValidator(this, 'SOUND', validateSoundName);
      },
    ],
  ];
  for (const [name, fn] of extensions) {
    if (!Blockly.Extensions.isRegistered(name)) Blockly.Extensions.register(name, fn);
  }
  const missing = blockDefinitions().filter((def) => !(def.type in Blockly.Blocks));
  if (missing.length > 0) Blockly.common.defineBlocksWithJsonArray(missing);
  if (!cssRegistered) {
    Blockly.Css.register(
      `${STEP_GRID_CSS}\n.ogl-strudel-name { fill-opacity: 0.65; font-style: italic; }`,
    );
    cssRegistered = true;
  }
}
