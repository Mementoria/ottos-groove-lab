import { render, screen } from '@testing-library/react';
import { Otto } from '../../src/otto/Otto';

describe('Otto', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an accessible image with eight tentacles', () => {
    const { container } = render(<Otto beatPhase={() => 0} level={() => 0} mood="idle" />);
    expect(screen.getByRole('img', { name: 'Otto the octopus' })).toBeInTheDocument();
    expect(container.querySelectorAll('g[stroke] > path')).toHaveLength(8);
  });

  it('cancels its animation frame on unmount', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(<Otto beatPhase={() => 0} level={() => 0} mood="cheer" />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
