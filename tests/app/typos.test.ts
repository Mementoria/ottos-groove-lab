// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brokenSourceIds } from '../../src/app/typos';
import { grid, layer, mod, muted, notes, program, sound } from '../../src/program/build';

describe('brokenSourceIds', () => {
  it('names the source of each layer whose pattern will not parse, muted ones included', async () => {
    const fine = sound('bd sd');
    const unclosed = sound('bd [sd hh');
    const quietTypo = notes('c3 <e3 g3');
    const p = program(
      120,
      layer(fine, mod('gain', 0.8)),
      layer(unclosed),
      muted(layer(quietTypo)),
      layer(grid('hh', [0, 2])),
    );
    expect(await brokenSourceIds(p)).toEqual([unclosed.id, quietTypo.id]);
  });

  it('is empty for a program that parses, and skips empty-pattern arms', async () => {
    expect(await brokenSourceIds(program(null, layer(sound('bd*4')), layer(sound('  '))))).toEqual(
      [],
    );
    expect(await brokenSourceIds(program(null))).toEqual([]);
  });
});
