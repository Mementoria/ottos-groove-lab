// @vitest-environment node
import { compileForCheck, onsets } from '../../src/audio/compile';

describe('compileForCheck', () => {
  it('neither reads nor writes globals (playback owns the global Strudel scope)', async () => {
    const decoy = () => {
      throw new Error('global s used');
    };
    Reflect.set(globalThis, 's', decoy);
    try {
      const found = onsets(await compileForCheck('stack(s("bd sd"), note("c3"))'), 1);
      expect(found).toHaveLength(3);
      expect(Reflect.get(globalThis, 's')).toBe(decoy);
      expect(Reflect.has(globalThis, 'note')).toBe(false);
    } finally {
      Reflect.deleteProperty(globalThis, 's');
    }
  });

  it('finds four kick onsets on the 16th grid', async () => {
    const found = onsets(await compileForCheck('s("bd*4")'), 1);
    expect(found).toHaveLength(4);
    expect(found.map((o) => o.step16)).toEqual([0, 4, 8, 12]);
    expect(found.every((o) => o.value['s'] === 'bd')).toBe(true);
  });

  it('samples a slowed signal into varying cutoff (lpf) values', async () => {
    const found = onsets(
      await compileForCheck('note("c2 eb2").s("sawtooth").lpf(sine.range(200, 2000).slow(4))'),
      4,
    );
    expect(found).toHaveLength(8);
    // lpf is an alias: the hap value key is `cutoff`.
    const values = found.map((o) => o.value['cutoff']);
    for (const v of values) {
      expect(typeof v).toBe('number');
      expect(v).toBeGreaterThanOrEqual(200);
      expect(v).toBeLessThanOrEqual(2000);
    }
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it('yields no onsets for silence', async () => {
    expect(onsets(await compileForCheck('silence'), 4)).toHaveLength(0);
  });

  it('reports null step16 for off-grid onsets', async () => {
    const found = onsets(await compileForCheck('s("bd*3")'), 1);
    expect(found.map((o) => o.step16)).toEqual([0, null, null]);
  });

  it('rejects on a syntax error', async () => {
    await expect(compileForCheck('s("bd" ')).rejects.toThrow();
  });
});
