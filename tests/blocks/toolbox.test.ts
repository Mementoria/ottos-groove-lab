import { BT, modBlockType } from '../../src/blocks/blockTypes';
import { categoryOfTypes } from '../../src/blocks/toolbox';

describe('categoryOfTypes', () => {
  it('finds the palette category of the first hinted type', () => {
    expect(categoryOfTypes([BT.grid])).toBe('Sounds');
    expect(categoryOfTypes([modBlockType('lpf'), BT.layer])).toBe('Filter');
  });

  it('skips types without a category', () => {
    expect(categoryOfTypes(['not_a_block', BT.notes])).toBe('Notes');
  });

  it('is null when nothing matches', () => {
    expect(categoryOfTypes([])).toBeNull();
    expect(categoryOfTypes(['not_a_block'])).toBeNull();
  });
});
