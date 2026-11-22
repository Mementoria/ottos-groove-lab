import type * as Blockly from 'blockly';
import {
  BLOCK_CATEGORIES,
  BT,
  DEFAULT_GRID_STEPS,
  DEFAULT_SIGNAL,
  NUMERIC_MODS,
  numericModOf,
  type BlockType,
} from './blockTypes';
import { CATEGORIES, CATEGORY_COLOURS, type Category } from './theme';

export type { Category } from './theme';

type BlockInfo = Blockly.utils.toolbox.BlockInfo;

export interface ToolboxCategory extends Blockly.utils.toolbox.StaticCategoryInfo {
  name: Category;
  contents: BlockInfo[];
}

export interface Toolbox extends Blockly.utils.toolbox.ToolboxInfo {
  kind: 'categoryToolbox';
  contents: ToolboxCategory[];
}

/** How a block appears in the palette: number slots get a number shadow, fields sensible starts. */
function paletteEntry(type: BlockType): BlockInfo {
  const mod = numericModOf(type);
  if (mod !== null) {
    const num = NUMERIC_MODS[mod].initial;
    return {
      kind: 'block',
      type,
      inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: num } } } },
    };
  }
  if (type === BT.grid) {
    return { kind: 'block', type, fields: { SOUND: 'bd', STEPS: DEFAULT_GRID_STEPS } };
  }
  if (type === BT.signal) {
    const { signal, min, max, slow } = DEFAULT_SIGNAL;
    return { kind: 'block', type, fields: { SIGNAL: signal, MIN: min, MAX: max, SLOW: slow } };
  }
  return { kind: 'block', type };
}

/** The palette for the blocks unlocked so far. Categories with no unlocked blocks are omitted. */
export function buildToolbox(unlocked: readonly BlockType[]): Toolbox {
  const open = new Set(unlocked);
  const contents = CATEGORIES.map((name): ToolboxCategory => ({
    kind: 'category',
    name,
    colour: CATEGORY_COLOURS[name],
    categorystyle: undefined,
    id: undefined,
    cssconfig: undefined,
    hidden: undefined,
    contents: BLOCK_CATEGORIES.filter(([type, cat]) => cat === name && open.has(type)).map(
      ([type]) => paletteEntry(type),
    ),
  })).filter((category) => category.contents.length > 0);
  return { kind: 'categoryToolbox', contents };
}

/** The palette category holding the first of `types` that has one (for "look here" hints). */
export function categoryOfTypes(types: readonly BlockType[]): Category | null {
  for (const type of types) {
    const entry = BLOCK_CATEGORIES.find(([t]) => t === type);
    if (entry) return entry[1];
  }
  return null;
}
