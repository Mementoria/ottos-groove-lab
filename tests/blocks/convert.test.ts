import * as Blockly from 'blockly';
import { beforeAll, describe, expect, it } from 'vitest';
import { BT, modBlockType, registerBlocks } from '../../src/blocks/blockTypes';
import {
  owningNodeId,
  programToWorkspaceState,
  workspaceToProgram,
} from '../../src/blocks/convert';
import { buildToolbox } from '../../src/blocks/toolbox';
import {
  bank,
  ftype,
  grid,
  layer,
  mod,
  muted,
  notes,
  osc,
  program,
  signal,
  sound,
} from '../../src/program/build';
import type { Program } from '../../src/program/types';

type BlockState = Blockly.serialization.blocks.State;

beforeAll(() => {
  registerBlocks();
});

/** The Task 2 sample: a 909 kick grid plus a filtered saw bass. */
function sampleProgram(): Program {
  const kick = layer(grid('bd', [0, 4, 8, 12]), bank('RolandTR909'));
  const bass = layer(
    notes('c2 c2 eb2 c3'),
    osc('sawtooth'),
    mod('lpf', signal('sine', 200, 2000, 4)),
  );
  return program(130, kick, bass);
}

/** Exercises every source kind, muting, every dropdown modifier, and number and signal args. */
function richProgram(): Program {
  return program(
    null,
    muted(layer(sound('hh*8'), mod('gain', 0.6), mod('pan', signal('perlin', 0, 1, 2)))),
    layer(
      notes('<c3 eb3> g3'),
      osc('square'),
      ftype('ladder'),
      mod('lpq', 12),
      mod('attack', 0.01),
      mod('room', 0.4),
    ),
    layer(grid('sd', [4, 12]), bank('RolandTR808'), mod('fast', 2)),
  );
}

function loadState(state: object): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}

function loadBlocks(blocks: BlockState[]): Blockly.Workspace {
  return loadState({ blocks: { languageVersion: 0, blocks } });
}

function roundTrip(p: Program): ReturnType<typeof workspaceToProgram> {
  return workspaceToProgram(loadState(programToWorkspaceState(p)));
}

/** Deep-copies a value with every `id` property removed, for structural comparison. */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, v]) => [key, withoutIds(v)]),
    );
  }
  return value;
}

function chain(...blocks: BlockState[]): BlockState {
  const [head, ...rest] = blocks;
  if (head === undefined) throw new Error('chain needs at least one block');
  return rest.length === 0 ? head : { ...head, next: { block: chain(...rest) } };
}

function hat(id: string, y: number, ...below: BlockState[]): BlockState {
  const top: BlockState = { type: BT.layer, id, x: 0, y };
  return below.length === 0 ? top : { ...top, next: { block: chain(...below) } };
}

function numberMod(name: 'lpf' | 'gain', id: string, value: number): BlockState {
  return {
    type: modBlockType(name),
    id,
    inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: value } } } },
  };
}

describe('programToWorkspaceState → workspaceToProgram', () => {
  it('round-trips the sample program, ignoring ids', () => {
    const p = sampleProgram();
    const { program: back, warnings } = roundTrip(p);
    expect(warnings).toEqual([]);
    expect(withoutIds(back)).toEqual(withoutIds(p));
  });

  it('round-trips every source kind, muting, and every argument kind', () => {
    const p = richProgram();
    const { program: back, warnings } = roundTrip(p);
    expect(warnings).toEqual([]);
    expect(withoutIds(back)).toEqual(withoutIds(p));
  });

  it('uses Program ids as block ids, so layer, source and modifier ids round-trip', () => {
    const p = sampleProgram();
    const { program: back } = roundTrip(p);
    const ids = (q: Program) =>
      q.layers.map((l) => [l.id, l.source.id, ...l.mods.map((m) => m.id)]);
    expect(ids(back)).toEqual(ids(p));
  });

  it('lays layers out top to bottom without overlap, with tempo first', () => {
    const p = sampleProgram();
    const state = programToWorkspaceState(p);
    const ws = loadState(state);
    const tops = ws.getTopBlocks(true);
    expect(tops.map((b) => b.type)).toEqual([BT.tempo, BT.layer, BT.layer]);
    const ys = tops.map((b) => b.getRelativeToSurfaceXY().y);
    // The kick arm has a hat, a source and one modifier: three rows that must fit before the bass.
    const [tempoY = 0, kickY = 0, bassY = 0] = ys;
    expect(kickY).toBeGreaterThan(tempoY);
    expect(bassY - kickY).toBeGreaterThanOrEqual(3 * 48);
  });

  it('omits the tempo block when bpm is null', () => {
    const ws = loadState(programToWorkspaceState(program(null, layer(sound('bd')))));
    expect(ws.getTopBlocks(false).map((b) => b.type)).toEqual([BT.layer]);
    expect(workspaceToProgram(ws).program.bpm).toBeNull();
  });
});

describe('workspaceToProgram: incomplete workspaces', () => {
  it('skips a hat with nothing under it, without a warning', () => {
    const ws = loadBlocks([hat('empty', 0), hat('ok', 300, { type: BT.sound, id: 's1' })]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(warnings).toEqual([]);
    expect(p.layers.map((l) => l.id)).toEqual(['ok']);
  });

  it('skips a hat whose first block is a modifier, warning on that block', () => {
    const ws = loadBlocks([
      hat('h1', 0, numberMod('lpf', 'lpf1', 800), { type: BT.sound, id: 's1' }),
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p.layers).toEqual([]);
    expect(warnings).toEqual([
      { blockId: 'lpf1', message: 'Start this arm with a sound or notes block' },
    ]);
  });

  it('warns about an orphan block and ignores it', () => {
    const ws = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }),
      { type: BT.osc, id: 'orphan', x: 0, y: 400, fields: { VALUE: 'square' } },
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(warnings).toEqual([{ blockId: 'orphan', message: 'Attach me under an arm' }]);
    expect(p.layers).toHaveLength(1);
    expect(p.layers[0]?.mods).toEqual([]);
  });

  it('produces no layers from a workspace of only orphans', () => {
    const ws = loadBlocks([
      { type: BT.osc, id: 'o1', x: 0, y: 0 },
      { ...numberMod('gain', 'g1', 0.5), x: 0, y: 200 },
      { type: BT.sound, id: 's1', x: 0, y: 400 },
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p).toEqual({ bpm: null, layers: [] });
    expect(warnings.map((w) => w.blockId)).toEqual(['o1', 'g1', 's1']);
  });

  it('uses the first tempo block and warns about the others', () => {
    const ws = loadBlocks([
      { type: BT.tempo, id: 't1', x: 0, y: 0, fields: { BPM: 120 } },
      { type: BT.tempo, id: 't2', x: 0, y: 100, fields: { BPM: 90 } },
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p.bpm).toBe(120);
    expect(warnings).toEqual([
      { blockId: 't2', message: 'Only the top tempo block counts. Remove this one.' },
    ]);
  });

  it('warns about a second source in an arm and leaves it out', () => {
    const ws = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }, { type: BT.notes, id: 'n1' }),
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p.layers[0]?.source.id).toBe('s1');
    expect(p.layers[0]?.mods).toEqual([]);
    expect(warnings).toEqual([
      { blockId: 'n1', message: 'One sound per arm. Start a new arm for this one.' },
    ]);
  });

  it('skips a modifier whose number is not finite, with a warning', () => {
    const ws = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }, numberMod('lpf', 'lpf1', 800)),
    ]);
    const lpf = ws.getBlockById('lpf1');
    lpf?.getInputTargetBlock('VALUE')?.setFieldValue(Infinity, 'NUM');
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p.layers[0]?.mods).toEqual([]);
    expect(warnings).toEqual([{ blockId: 'lpf1', message: 'This needs an ordinary number' }]);
  });

  it('skips a modifier with nothing in its value slot, with a warning', () => {
    const ws = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }, { type: modBlockType('gain'), id: 'g1' }),
    ]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(p.layers[0]?.mods).toEqual([]);
    expect(warnings).toEqual([{ blockId: 'g1', message: 'Give me a number or a wave' }]);
  });

  it('skips disabled blocks without a warning', () => {
    const ws = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }, numberMod('gain', 'g1', 0.5)),
      hat('h2', 300, { type: BT.sound, id: 's2' }),
    ]);
    ws.getBlockById('g1')?.setDisabledReason(true, 'MANUALLY_DISABLED');
    ws.getBlockById('h2')?.setDisabledReason(true, 'MANUALLY_DISABLED');
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(warnings).toEqual([]);
    expect(p.layers.map((l) => [l.id, l.mods.length])).toEqual([['h1', 0]]);
  });

  it.each([
    [BT.sound, '', 'Type a pattern here, like bd sd'],
    [BT.notes, '   ', 'Type a pattern here, like c3 e3 g3'],
  ])('warns on a %s block whose pattern is %j, keeping the layer', (type, mini, message) => {
    const ws = loadBlocks([hat('h1', 0, { type, id: 'src', fields: { MINI: mini } })]);
    const { program: p, warnings } = workspaceToProgram(ws);
    expect(warnings).toEqual([{ blockId: 'src', message }]);
    expect(p.layers.map((l) => l.id)).toEqual(['h1']);
  });

  it('orders layers by their position on the workspace, top to bottom', () => {
    const ws = loadBlocks([
      hat('lower', 500, { type: BT.sound, id: 's1' }),
      hat('upper', 0, { type: BT.sound, id: 's2' }),
    ]);
    expect(workspaceToProgram(ws).program.layers.map((l) => l.id)).toEqual(['upper', 'lower']);
  });
});

describe('text field validators', () => {
  it('rejects quotes and backslashes in a mini string', () => {
    const ws = loadBlocks([{ type: BT.sound, id: 's1', fields: { MINI: 'bd sd' } }]);
    const block = ws.getBlockById('s1');
    block?.setFieldValue('bd "sd"', 'MINI');
    block?.setFieldValue('bd \\ sd', 'MINI');
    expect(block?.getFieldValue('MINI')).toBe('bd sd');
  });

  it.each(['', '   ', 'bd sd', 'b"d', 'b\\d'])('rejects %j as a drum sound name', (bad) => {
    const ws = loadBlocks([{ type: BT.grid, id: 'g1', fields: { SOUND: 'hh' } }]);
    const block = ws.getBlockById('g1');
    block?.setFieldValue(bad, 'SOUND');
    expect(block?.getFieldValue('SOUND')).toBe('hh');
  });

  it('accepts a sample name with an index', () => {
    const ws = loadBlocks([{ type: BT.grid, id: 'g1', fields: { SOUND: 'hh' } }]);
    const block = ws.getBlockById('g1');
    block?.setFieldValue('bd:3', 'SOUND');
    expect(block?.getFieldValue('SOUND')).toBe('bd:3');
  });
});

describe('registerBlocks', () => {
  it('is safe to call again', () => {
    expect(() => {
      registerBlocks();
      registerBlocks();
    }).not.toThrow();
  });
});

describe('buildToolbox', () => {
  it('contains only categories that have unlocked blocks', () => {
    const toolbox = buildToolbox(['ogl_layer', 'ogl_sound']);
    expect(toolbox.contents.map((c) => c.name)).toEqual(['Layers', 'Sounds']);
    expect(toolbox.contents.flatMap((c) => c.contents.map((b) => b.type))).toEqual([
      'ogl_layer',
      'ogl_sound',
    ]);
  });

  it('gives numeric modifiers a number shadow and every category a distinct colour', () => {
    const toolbox = buildToolbox([
      BT.layer,
      BT.sound,
      BT.notes,
      modBlockType('lpf'),
      modBlockType('attack'),
      BT.signal,
      modBlockType('room'),
      BT.tempo,
    ]);
    const lpf = toolbox.contents
      .flatMap((c) => c.contents)
      .find((b) => b.type === modBlockType('lpf'));
    expect(lpf?.inputs?.VALUE?.shadow?.type).toBe('math_number');
    const colours = toolbox.contents.map((c) => c.colour);
    expect(colours).toHaveLength(8);
    expect(new Set(colours).size).toBe(8);
  });

  it('only offers blocks that are registered', () => {
    const all = Object.keys(Blockly.Blocks).filter((t) => t.startsWith('ogl_'));
    const toolbox = buildToolbox(all);
    const offered = toolbox.contents.flatMap((c) => c.contents.map((b) => b.type));
    expect([...offered].sort()).toEqual([...all].sort());
  });
});

describe('owningNodeId', () => {
  // A kick with a plain-number lpf and a gain driven by a signal block.
  const kick = layer(sound('bd sd'), mod('lpf', 800), mod('gain', signal('sine', 0.2, 0.8, 2)));
  const lpfId = kick.mods[0]?.id ?? '';
  const gainId = kick.mods[1]?.id ?? '';
  let ws: Blockly.Workspace;

  beforeEach(() => {
    ws = loadState(programToWorkspaceState(program(120, kick)));
  });

  afterEach(() => {
    ws.dispose();
  });

  it("resolves a modifier's number shadow to the modifier", () => {
    expect(owningNodeId(ws, `${lpfId}:value`)).toBe(lpfId);
  });

  it("resolves a signal block in a modifier's slot to the modifier", () => {
    expect(owningNodeId(ws, `${gainId}:signal`)).toBe(gainId);
  });

  it('resolves layer, source and modifier blocks to themselves', () => {
    expect(owningNodeId(ws, kick.id)).toBe(kick.id);
    expect(owningNodeId(ws, kick.source.id)).toBe(kick.source.id);
    expect(owningNodeId(ws, lpfId)).toBe(lpfId);
  });

  it('resolves the tempo block and an unknown id to null', () => {
    expect(owningNodeId(ws, 'tempo')).toBeNull();
    expect(owningNodeId(ws, 'nope')).toBeNull();
  });

  it('resolves an orphan, and the shadow inside it, to null', () => {
    const orphans = loadBlocks([
      hat('h1', 0, { type: BT.sound, id: 's1' }),
      { ...numberMod('lpf', 'orphan', 800), x: 0, y: 400 },
    ]);
    const shadowId = orphans.getBlockById('orphan')?.getInputTargetBlock('VALUE')?.id ?? '';
    expect(shadowId).not.toBe('');
    expect(owningNodeId(orphans, 'orphan')).toBeNull();
    expect(owningNodeId(orphans, shadowId)).toBeNull();
    expect(owningNodeId(orphans, 's1')).toBe('s1');
    orphans.dispose();
  });
});
