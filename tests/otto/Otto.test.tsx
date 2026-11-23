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

  /** Captures Otto's animation callback so a test can run one frame by hand. */
  function captureFrame(): () => FrameRequestCallback {
    let callback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      callback = cb;
      return 1;
    });
    return () => {
      if (!callback) throw new Error('no frame requested');
      return callback;
    };
  }

  const translateY = (el: Element | null): number => {
    const m = /translate\(0 (-?[\d.]+)\)/.exec(el?.getAttribute('transform') ?? '');
    return m?.[1] ? Number(m[1]) : 0;
  };
  const rootY = (path: Element | undefined): number => {
    const m = /^M-?[\d.]+ (-?[\d.]+)/.exec(path?.getAttribute('d') ?? '');
    return m?.[1] ? Number(m[1]) : Number.NaN;
  };

  it('keeps his arms attached while he bobs to the beat', () => {
    const frame = captureFrame();
    const { container } = render(<Otto beatPhase={() => 0} level={() => 1} mood="talking" />);
    const restRoot = rootY(container.querySelectorAll('g[stroke] > path')[0]);
    frame()(0);

    const bob = translateY(container.querySelector('.otto-body'));
    expect(bob).toBeLessThan(0);
    // The arm's root rises exactly as far as the body.
    expect(rootY(container.querySelectorAll('g[stroke] > path')[0])).toBeCloseTo(restRoot + bob, 1);
  });

  it('jumps as a whole when he cheers, arms and all', () => {
    const frame = captureFrame();
    const { container } = render(<Otto beatPhase={() => 0} level={() => 0} mood="cheer" />);
    frame()(performance.now() + 150);

    const figure = container.querySelector('.otto-figure');
    expect(translateY(figure)).toBeLessThan(0);
    expect(figure?.querySelector('g[stroke]')).not.toBeNull();
    expect(figure?.querySelector('.otto-body')).not.toBeNull();
  });

  it('closes his eyes when asleep', () => {
    const { container, rerender } = render(
      <Otto beatPhase={() => 0} level={() => 0} mood="asleep" />,
    );
    expect(container.querySelector('.otto-eyes-closed')).not.toBeNull();
    expect(container.querySelector('.otto-eyes-open')).toBeNull();
    rerender(<Otto beatPhase={() => 0} level={() => 0} mood="idle" />);
    expect(container.querySelector('.otto-eyes-open')).not.toBeNull();
  });
});
