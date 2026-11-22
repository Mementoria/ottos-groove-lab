import {
  DEFAULT_HIGHLIGHT_TTL_MS,
  highlightBus,
  highlightTtl,
  type Highlight,
} from '../../src/otto/highlightBus';

describe('highlightBus', () => {
  it('delivers emitted highlights to subscribers', () => {
    const received: Highlight[] = [];
    const unsubscribe = highlightBus.subscribe((h) => received.push(h));
    const highlight: Highlight = { nodeIds: ['layer-1'], blockTypes: ['ogl_sound'], ttlMs: 1000 };
    highlightBus.emit(highlight);
    unsubscribe();
    expect(received).toEqual([highlight]);
  });

  it('delivers to every subscriber', () => {
    const first = vi.fn<(h: Highlight) => void>();
    const second = vi.fn<(h: Highlight) => void>();
    const offFirst = highlightBus.subscribe(first);
    const offSecond = highlightBus.subscribe(second);
    highlightBus.emit({ nodeIds: ['a'] });
    offFirst();
    offSecond();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after unsubscribe', () => {
    const cb = vi.fn<(h: Highlight) => void>();
    const unsubscribe = highlightBus.subscribe(cb);
    unsubscribe();
    highlightBus.emit({ nodeIds: ['a'] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('keeps separate subscriptions of the same callback independent', () => {
    const cb = vi.fn<(h: Highlight) => void>();
    const offFirst = highlightBus.subscribe(cb);
    const offSecond = highlightBus.subscribe(cb);
    offFirst();
    highlightBus.emit({ nodeIds: ['a'] });
    offSecond();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('defaults the ttl to 2500 ms', () => {
    expect(DEFAULT_HIGHLIGHT_TTL_MS).toBe(2500);
    expect(highlightTtl({ nodeIds: ['a'] })).toBe(2500);
    expect(highlightTtl({ nodeIds: ['a'], ttlMs: 400 })).toBe(400);
  });
});
