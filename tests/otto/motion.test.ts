import { bobOffset, rms, tentaclePath } from '../../src/otto/motion';

describe('rms', () => {
  it('is 0 for silence', () => {
    expect(rms(new Float32Array(64))).toBe(0);
  });

  it('is 0 for an empty buffer', () => {
    expect(rms(new Float32Array(0))).toBe(0);
  });

  it('is about 1 for a full-scale square wave', () => {
    const square = Float32Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    expect(rms(square)).toBeCloseTo(1, 5);
  });
});

describe('tentaclePath', () => {
  it('is deterministic', () => {
    expect(tentaclePath(3, 0.25, 0.6)).toBe(tentaclePath(3, 0.25, 0.6));
  });

  it('differs between phase 0 and 0.5 at level 1', () => {
    expect(tentaclePath(2, 0, 1)).not.toBe(tentaclePath(2, 0.5, 1));
  });

  it('differs between tentacles', () => {
    expect(tentaclePath(0, 0.3, 1)).not.toBe(tentaclePath(1, 0.3, 1));
  });

  it('returns a finite SVG path for all eight tentacles', () => {
    for (let i = 0; i < 8; i += 1) {
      const d = tentaclePath(i, 0.7, 0.5);
      expect(d).toMatch(/^M[-\d. ]+Q[-\d. ]+$/);
    }
  });
});

describe('bobOffset', () => {
  it('is no bigger at level 0 than at level 1', () => {
    for (const phase of [0, 0.1, 0.25, 0.5, 0.9]) {
      expect(bobOffset(phase, 0)).toBeLessThanOrEqual(bobOffset(phase, 1));
    }
  });

  it('stays within 0..8 px', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const b = bobOffset(p, 1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(8);
    }
  });
});
