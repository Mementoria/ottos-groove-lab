import type * as Blockly from 'blockly';
import type { Layer, Modifier, NumArg, NumericModName, Program, Source } from '../program/types';
import {
  BANK_OPTIONS,
  BT,
  FTYPE_OPTIONS,
  NUMERIC_MODS,
  OSCILLATOR_OPTIONS,
  SIGNAL_OPTIONS,
  modBlockType,
  numericModOf,
} from './blockTypes';
import { STEP_COUNT } from './FieldStepGrid';

export interface ConvertWarning {
  blockId: string;
  message: string;
}

export const WARNINGS = {
  startWithSource: 'Start this arm with a sound or notes block',
  orphan: 'Attach me under an arm',
  extraTempo: 'Only the top tempo block counts. Remove this one.',
  secondSource: 'One sound per arm. Start a new arm for this one.',
  badNumber: 'This needs an ordinary number',
  noValue: 'Give me a number or a wave',
  unknown: "I don't know this block",
  emptySound: 'Type a pattern here, like bd sd',
  emptyNotes: 'Type a pattern here, like c3 e3 g3',
} as const;

type BlockState = Blockly.serialization.blocks.State;

export type WorkspaceState = {
  blocks: { languageVersion: number; blocks: BlockState[] };
};

type Options<T extends string> = readonly (readonly [string, T])[];

/* ---------- Workspace → Program ---------- */

function stringField(block: Blockly.Block, name: string): string | null {
  const value: unknown = block.getFieldValue(name);
  return typeof value === 'string' ? value : null;
}

function finiteField(block: Blockly.Block, name: string): number | null {
  const value: unknown = block.getFieldValue(name);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionField<T extends string>(
  block: Blockly.Block,
  name: string,
  options: Options<T>,
): T | null {
  const value = stringField(block, name);
  return options.find(([, v]) => v === value)?.[1] ?? null;
}

function toSource(block: Blockly.Block): Source | null {
  const id = block.id;
  switch (block.type) {
    case BT.sound:
      return { id, kind: 'sound', mini: stringField(block, 'MINI') ?? '' };
    case BT.notes:
      return { id, kind: 'notes', mini: stringField(block, 'MINI') ?? '' };
    case BT.grid: {
      const steps = stringField(block, 'STEPS') ?? '';
      return {
        id,
        kind: 'grid',
        sound: stringField(block, 'SOUND') ?? '',
        steps: Array.from({ length: STEP_COUNT }, (_, i) => steps[i] === 'x'),
      };
    }
    default:
      return null;
  }
}

function toNumArg(block: Blockly.Block): NumArg | string {
  const target = block.getInputTargetBlock('VALUE');
  if (target === null) return WARNINGS.noValue;
  if (target.type === 'math_number') {
    const value = finiteField(target, 'NUM');
    return value === null ? WARNINGS.badNumber : { kind: 'number', value };
  }
  if (target.type === BT.signal) {
    const signal = optionField(target, 'SIGNAL', SIGNAL_OPTIONS);
    const min = finiteField(target, 'MIN');
    const max = finiteField(target, 'MAX');
    const slow = finiteField(target, 'SLOW');
    if (signal === null || min === null || max === null || slow === null) return WARNINGS.badNumber;
    return { kind: 'signal', signal, min, max, slow };
  }
  return WARNINGS.noValue;
}

/** The modifier a chained block stands for, or a warning message. */
function toModifier(block: Blockly.Block): Modifier | string {
  const id = block.id;
  const numeric = numericModOf(block.type);
  if (numeric !== null) {
    const arg = toNumArg(block);
    return typeof arg === 'string' ? arg : { id, name: numeric, arg };
  }
  switch (block.type) {
    case BT.osc: {
      const value = optionField(block, 'VALUE', OSCILLATOR_OPTIONS);
      return value === null ? WARNINGS.unknown : { id, name: 's', value };
    }
    case BT.bank: {
      const value = optionField(block, 'VALUE', BANK_OPTIONS);
      return value === null ? WARNINGS.unknown : { id, name: 'bank', value };
    }
    case BT.ftype: {
      const value = optionField(block, 'VALUE', FTYPE_OPTIONS);
      return value === null ? WARNINGS.unknown : { id, name: 'ftype', value };
    }
    default:
      return toSource(block) === null ? WARNINGS.unknown : WARNINGS.secondSource;
  }
}

/** The enabled blocks chained below `block`, in order. */
function chainBelow(block: Blockly.Block): Blockly.Block[] {
  const chain: Blockly.Block[] = [];
  for (let b = block.getNextBlock(); b !== null; b = b.getNextBlock()) {
    if (b.isEnabled()) chain.push(b);
  }
  return chain;
}

function toLayer(
  hat: Blockly.Block,
  warn: (blockId: string, message: string) => void,
): Layer | null {
  const [first, ...rest] = chainBelow(hat);
  if (first === undefined) return null;
  const source = toSource(first);
  if (source === null) {
    warn(first.id, WARNINGS.startWithSource);
    return null;
  }
  // Codegen drops a blank pattern; say so on the block rather than going silent.
  if (source.kind !== 'grid' && source.mini.trim() === '') {
    warn(first.id, source.kind === 'sound' ? WARNINGS.emptySound : WARNINGS.emptyNotes);
  }
  const mods: Modifier[] = [];
  for (const block of rest) {
    const mod = toModifier(block);
    if (typeof mod === 'string') warn(block.id, mod);
    else mods.push(mod);
  }
  return { id: hat.id, muted: hat.getFieldValue('MUTED') === 'TRUE', source, mods };
}

/**
 * Reads the program from the workspace. Arms (layer hats) become layers in top-to-bottom order;
 * anything that can't play is skipped with a warning on the block responsible.
 */
export function workspaceToProgram(ws: Blockly.Workspace): {
  program: Program;
  warnings: ConvertWarning[];
} {
  const warnings: ConvertWarning[] = [];
  const warn = (blockId: string, message: string) => {
    warnings.push({ blockId, message });
  };
  let bpm: number | null = null;
  let sawTempo = false;
  const layers: Layer[] = [];
  for (const top of ws.getTopBlocks(true)) {
    if (top.type === BT.layer) {
      if (!top.isEnabled()) continue;
      const layer = toLayer(top, warn);
      if (layer !== null) layers.push(layer);
    } else if (top.type === BT.tempo) {
      if (!top.isEnabled()) continue;
      if (sawTempo) {
        warn(top.id, WARNINGS.extraTempo);
      } else {
        sawTempo = true;
        bpm = finiteField(top, 'BPM');
      }
    } else {
      warn(top.id, WARNINGS.orphan);
    }
  }
  return { program: { bpm, layers }, warnings };
}

/** Every node id in the program: layers, sources and modifiers (the ids codegen spans use). */
function nodeIds(p: Program): Set<string> {
  return new Set(p.layers.flatMap((l) => [l.id, l.source.id, ...l.mods.map((m) => m.id)]));
}

/**
 * The program node a touched block belongs to: the block itself if it's a layer, source or
 * modifier the program uses; for a shadow or plugged-in value block (a modifier's number or
 * wave), the node that owns its slot. Null for anything that isn't in the program (orphans,
 * skipped blocks, the tempo block).
 */
export function owningNodeId(ws: Blockly.Workspace, blockId: string): string | null {
  const nodes = nodeIds(workspaceToProgram(ws).program);
  let block = ws.getBlockById(blockId);
  while (block !== null) {
    if (nodes.has(block.id)) return block.id;
    if (!block.isShadow() && block.outputConnection === null) return null;
    block = block.getParent();
  }
  return null;
}

/* ---------- Program → Workspace ---------- */

// Layout, in workspace units: generous enough for Zelos block heights so stacks never overlap.
const LEFT = 24;
const TOP = 24;
const ROW_HEIGHT = 56;
const STACK_GAP = 40;

function numArgState(
  modId: string,
  name: NumericModName,
  arg: NumArg,
): Blockly.serialization.blocks.ConnectionState {
  const shadowValue = arg.kind === 'number' ? arg.value : NUMERIC_MODS[name].initial;
  const shadow: BlockState = {
    type: 'math_number',
    id: `${modId}:value`,
    fields: { NUM: shadowValue },
  };
  if (arg.kind === 'number') return { shadow };
  return {
    shadow,
    block: {
      type: BT.signal,
      id: `${modId}:signal`,
      fields: { SIGNAL: arg.signal, MIN: arg.min, MAX: arg.max, SLOW: arg.slow },
    },
  };
}

function modifierState(m: Modifier): BlockState {
  switch (m.name) {
    case 's':
      return { type: BT.osc, id: m.id, fields: { VALUE: m.value } };
    case 'bank':
      return { type: BT.bank, id: m.id, fields: { VALUE: m.value } };
    case 'ftype':
      return { type: BT.ftype, id: m.id, fields: { VALUE: m.value } };
    default:
      return {
        type: modBlockType(m.name),
        id: m.id,
        inputs: { VALUE: numArgState(m.id, m.name, m.arg) },
      };
  }
}

function sourceState(s: Source): BlockState {
  switch (s.kind) {
    case 'sound':
      return { type: BT.sound, id: s.id, fields: { MINI: s.mini } };
    case 'notes':
      return { type: BT.notes, id: s.id, fields: { MINI: s.mini } };
    case 'grid': {
      const steps = Array.from({ length: STEP_COUNT }, (_, i) => (s.steps[i] === true ? 'x' : '.'));
      return { type: BT.grid, id: s.id, fields: { SOUND: s.sound, STEPS: steps.join('') } };
    }
  }
}

/** Links blocks into a vertical stack, first on top. */
function stack(blocks: BlockState[]): BlockState | undefined {
  return blocks.reduceRight<BlockState | undefined>(
    (below, block) => (below === undefined ? block : { ...block, next: { block: below } }),
    undefined,
  );
}

/**
 * Serialization state for `Blockly.serialization.workspaces.load`. Block ids are the Program's
 * node ids; the tempo block (if any) sits on top and the arms follow, top to bottom.
 */
export function programToWorkspaceState(p: Program): WorkspaceState {
  const blocks: BlockState[] = [];
  let y = TOP;
  if (p.bpm !== null) {
    blocks.push({ type: BT.tempo, id: 'tempo', x: LEFT, y, fields: { BPM: p.bpm } });
    y += ROW_HEIGHT + STACK_GAP;
  }
  for (const l of p.layers) {
    const below = stack([sourceState(l.source), ...l.mods.map(modifierState)]);
    blocks.push({
      type: BT.layer,
      id: l.id,
      x: LEFT,
      y,
      fields: { MUTED: l.muted },
      ...(below === undefined ? {} : { next: { block: below } }),
    });
    y += (2 + l.mods.length) * ROW_HEIGHT + STACK_GAP;
  }
  return { blocks: { languageVersion: 0, blocks } };
}
