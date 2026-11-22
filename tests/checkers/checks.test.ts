// @vitest-environment node
import { buildContext, controlKey, runCheck } from '../../src/checkers/checks';
import type { Check } from '../../src/checkers/checks';
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

async function passes(check: Check, ...args: Parameters<typeof program>): Promise<boolean> {
  const ctx = await buildContext(program(...args), true);
  return runCheck(check, ctx).pass;
}

describe('controlKey', () => {
  it('maps method names to canonical control keys', () => {
    expect(controlKey('lpf')).toBe('cutoff');
    expect(controlKey('lpq')).toBe('resonance');
    expect(controlKey('hpf')).toBe('hcutoff');
    expect(controlKey('lpa')).toBe('lpattack');
    expect(controlKey('lpd')).toBe('lpdecay');
    expect(controlKey('lps')).toBe('lpsustain');
    expect(controlKey('gain')).toBe('gain');
  });
});

describe('runCheck', () => {
  const kick = layer(grid('bd', [0, 4, 8, 12]));

  it('manual never passes by itself', async () => {
    expect(await passes({ kind: 'manual' }, 120, kick)).toBe(false);
  });

  it('playing reflects ctx.playing', async () => {
    const on = await buildContext(program(120, kick), true);
    const off = await buildContext(program(120, kick), false);
    expect(runCheck({ kind: 'playing' }, on).pass).toBe(true);
    expect(runCheck({ kind: 'playing' }, off).pass).toBe(false);
  });

  it('all and any combine', async () => {
    const yes: Check = { kind: 'hasSound', s: 'bd' };
    const no: Check = { kind: 'hasSound', s: 'sd' };
    expect(await passes({ kind: 'all', checks: [yes, yes] }, 120, kick)).toBe(true);
    expect(await passes({ kind: 'all', checks: [yes, no] }, 120, kick)).toBe(false);
    expect(await passes({ kind: 'any', checks: [no, yes] }, 120, kick)).toBe(true);
    expect(await passes({ kind: 'any', checks: [no, no] }, 120, kick)).toBe(false);
  });

  it('layers counts the program layers', async () => {
    expect(await passes({ kind: 'layers', min: 2 }, 120, kick, layer(grid('hh', [2])))).toBe(true);
    expect(await passes({ kind: 'layers', min: 2 }, 120, kick)).toBe(false);
  });

  it('tempo reads program.bpm', async () => {
    const check: Check = { kind: 'tempo', bpm: 120, tolerance: 5 };
    expect(await passes(check, 122, kick)).toBe(true);
    expect(await passes(check, 140, kick)).toBe(false);
    expect(await passes(check, null, kick)).toBe(false);
  });

  it('onsetsPerCycle counts matching cycle-0 onsets', async () => {
    const hats = layer(sound('hh*8'));
    expect(await passes({ kind: 'onsetsPerCycle', where: { s: 'hh' }, count: 8 }, 120, kick, hats)).toBe(true);
    expect(await passes({ kind: 'onsetsPerCycle', where: { s: 'bd' }, count: 8 }, 120, kick, hats)).toBe(false);
    expect(await passes({ kind: 'onsetsPerCycle', where: {}, count: 12 }, 120, kick, hats)).toBe(true);
  });

  it('where can match on bank', async () => {
    const check: Check = { kind: 'onsetsPerCycle', where: { bank: 'RolandTR909' }, count: 4 };
    expect(await passes(check, 120, layer(grid('bd', [0, 4, 8, 12]), bank('RolandTR909')))).toBe(true);
    expect(await passes(check, 120, kick)).toBe(false);
  });

  it('onsetsAt requires exactly these steps', async () => {
    expect(await passes({ kind: 'onsetsAt', where: { s: 'bd' }, steps: [0, 4, 8, 12] }, 120, kick)).toBe(true);
    expect(await passes({ kind: 'onsetsAt', where: { s: 'bd' }, steps: [0, 8] }, 120, kick)).toBe(false);
    expect(await passes({ kind: 'onsetsAt', where: { s: 'bd' }, steps: [0, 4, 8, 12, 14] }, 120, kick)).toBe(false);
  });

  it('onsetsAt fails on off-grid matching onsets', async () => {
    const triplet = layer(sound('bd*3'));
    expect(await passes({ kind: 'onsetsAt', where: { s: 'bd' }, steps: [0, 5, 11] }, 120, triplet)).toBe(false);
  });

  it('hasSound looks for the sound name', async () => {
    expect(await passes({ kind: 'hasSound', s: 'bd' }, 120, kick)).toBe(true);
    expect(await passes({ kind: 'hasSound', s: 'cp' }, 120, kick)).toBe(false);
  });

  it('distinctNotes counts distinct note values', async () => {
    const bass = layer(notes('c2 eb2 g2 c2'), osc('sawtooth'));
    expect(await passes({ kind: 'distinctNotes', min: 3 }, 120, bass)).toBe(true);
    expect(await passes({ kind: 'distinctNotes', min: 4 }, 120, bass)).toBe(false);
  });

  it('control passes on lpf 400 with max 1000 (method name translated)', async () => {
    const l = layer(notes('c2 eb2'), osc('sawtooth'), mod('lpf', 400));
    expect(await passes({ kind: 'control', control: 'lpf', max: 1000 }, 120, l)).toBe(true);
    expect(await passes({ kind: 'control', control: 'lpf', min: 500 }, 120, l)).toBe(false);
  });

  it('control fails when the control is absent', async () => {
    const l = layer(notes('c2 eb2'));
    expect(await passes({ kind: 'control', control: 'lpf', max: 1000 }, 120, l)).toBe(false);
  });

  it('control equals compares raw values', async () => {
    const l = layer(notes('c2 eb2'), osc('sawtooth'), ftype('ladder'));
    expect(await passes({ kind: 'control', control: 's', equals: 'sawtooth' }, 120, l)).toBe(true);
    expect(await passes({ kind: 'control', control: 's', equals: 'square' }, 120, l)).toBe(false);
    expect(await passes({ kind: 'control', control: 'ftype', equals: 'ladder' }, 120, l)).toBe(true);
  });

  it('control requires every matching onset to satisfy, and honours where', async () => {
    const quiet = layer(grid('bd', [0]), mod('gain', 0.5));
    const loud = layer(grid('hh', [0]), mod('gain', 1.5));
    const check: Check = { kind: 'control', control: 'gain', max: 1 };
    expect(await passes(check, 120, quiet, loud)).toBe(false);
    expect(await passes({ ...check, where: { s: 'bd' } }, 120, quiet, loud)).toBe(true);
  });

  it('controlVaries passes on a sweeping lpf and fails on a constant one', async () => {
    const sweep = layer(
      notes('c2 eb2'),
      osc('sawtooth'),
      mod('lpf', signal('sine', 200, 2000, 4)),
    );
    const flat = layer(notes('c2 eb2'), osc('sawtooth'), mod('lpf', 800));
    const check: Check = { kind: 'controlVaries', control: 'lpf', cycles: 4, minSpread: 500 };
    expect(await passes(check, 120, sweep)).toBe(true);
    expect(await passes(check, 120, flat)).toBe(false);
  });

  it('controlVaries honours where and cycles', async () => {
    const sweep = layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 2000, 4)));
    const other = layer(grid('hh', [0]), mod('lpf', 800));
    const check: Check = { kind: 'controlVaries', control: 'lpf', cycles: 4, minSpread: 500 };
    expect(await passes({ ...check, where: { s: 'hh' } }, 120, sweep, other)).toBe(false);
    // Cycle 0 only covers the first quarter of the slowed sine (about 1100 to 2000).
    expect(await passes({ ...check, cycles: 1, minSpread: 1200 }, 120, sweep)).toBe(false);
    expect(await passes({ ...check, minSpread: 1200 }, 120, sweep)).toBe(true);
  });

  it('signalSlow passes when the control is driven by a slow enough signal', async () => {
    const check: Check = { kind: 'signalSlow', control: 'lpf', min: 8 };
    const slow = layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 2000, 8)));
    const slower = layer(notes('c2 eb2'), mod('lpf', signal('tri', 200, 2000, 16)));
    expect(await passes(check, 120, slow)).toBe(true);
    expect(await passes(check, 120, kick, slower)).toBe(true);
  });

  it('signalSlow fails on a fast signal, a plain number, another control or a muted arm', async () => {
    const check: Check = { kind: 'signalSlow', control: 'lpf', min: 8 };
    const fast = layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 2000, 4)));
    const fixed = layer(notes('c2 eb2'), mod('lpf', 800));
    const elsewhere = layer(notes('c2 eb2'), mod('lpf', 800), mod('lpq', signal('sine', 1, 20, 8)));
    const silenced = muted(layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 2000, 8))));
    expect(await passes(check, 120, fast)).toBe(false);
    expect(await passes(check, 120, fixed)).toBe(false);
    expect(await passes(check, 120, elsewhere)).toBe(false);
    expect(await passes(check, 120, kick, silenced)).toBe(false);
  });

  it('signalRange passes when the control is driven by a wide enough signal', async () => {
    const check: Check = { kind: 'signalRange', control: 'lpf', minSpread: 500 };
    const wide = layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 1000, 8)));
    const reversed = layer(notes('c2 eb2'), mod('lpf', signal('saw', 1000, 200, 4)));
    expect(await passes(check, 120, wide)).toBe(true);
    expect(await passes(check, 120, kick, reversed)).toBe(true);
  });

  it('signalRange fails on a narrow signal, a plain number, another control or a muted arm', async () => {
    const check: Check = { kind: 'signalRange', control: 'lpf', minSpread: 500 };
    const narrow = layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 600, 8)));
    const fixed = layer(notes('c2 eb2'), mod('lpf', 800));
    const elsewhere = layer(
      notes('c2 eb2'),
      mod('lpf', 800),
      mod('lpq', signal('sine', 0, 1000, 8)),
    );
    const silenced = muted(layer(notes('c2 eb2'), mod('lpf', signal('sine', 200, 1000, 8))));
    expect(await passes(check, 120, narrow)).toBe(false);
    expect(await passes(check, 120, fixed)).toBe(false);
    expect(await passes(check, 120, elsewhere)).toBe(false);
    expect(await passes(check, 120, kick, silenced)).toBe(false);
  });
});
