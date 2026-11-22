import { validateSoundName } from '../../src/blocks/blockTypes';

describe('validateSoundName', () => {
  it('accepts a single sample name, with or without a sample number', () => {
    expect(validateSoundName('bd')).toBe('bd');
    expect(validateSoundName('bd:3')).toBe('bd:3');
    expect(validateSoundName('808_bd-2')).toBe('808_bd-2');
  });

  it('rejects mini-notation operators, which would play differently from the grid', () => {
    for (const op of ['*', '/', '!', '@', '<', '>', '[', ']', ',', '~', '(', ')']) {
      expect(validateSoundName(`bd${op}2`)).toBeNull();
    }
    for (const op of ['{', '}', '|', '?', '^']) {
      expect(validateSoundName(`bd${op}`)).toBeNull();
    }
  });

  it('allows a colon only as a sample number', () => {
    expect(validateSoundName('bd:')).toBeNull();
    expect(validateSoundName('bd:x')).toBeNull();
    expect(validateSoundName(':3')).toBeNull();
    expect(validateSoundName('bd:3:4')).toBeNull();
  });

  it('rejects spaces and characters that break out of a quoted string', () => {
    expect(validateSoundName('bd sd')).toBeNull();
    expect(validateSoundName('bd"')).toBeNull();
    expect(validateSoundName('bd\\')).toBeNull();
    expect(validateSoundName('')).toBeNull();
  });
});
