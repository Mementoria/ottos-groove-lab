import { render } from '@testing-library/react';
import { ArmGlyph } from '../../src/otto/ArmGlyph';
import { tentaclePath } from '../../src/otto/motion';

describe('ArmGlyph', () => {
  it('draws eight arms and lights the one it holds', () => {
    const { container } = render(<ArmGlyph arm={5} />);
    expect(container.querySelectorAll('path')).toHaveLength(8);
    const held = container.querySelectorAll('.arm-glyph-held');
    expect(held).toHaveLength(1);
    expect(held[0]?.getAttribute('d')).toBe(tentaclePath(5, 0, 0));
  });

  it('is decorative', () => {
    const { container } = render(<ArmGlyph arm={0} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
