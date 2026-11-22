import type { NumericModName } from '../program/types';

// Block type names without Blockly itself, so lesson content (and the course map that reads it)
// can name blocks without pulling Blockly into the first bundle.

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

export const MOD_PREFIX = 'ogl_mod_';

export function modBlockType(name: NumericModName): BlockType {
  return `${MOD_PREFIX}${name}`;
}
