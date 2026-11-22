import type { BlockType } from '../blocks/blockTypes';

/** "Glow these": blocks by type or node id in the blocks pane, node spans in the code pane. */
export interface Highlight {
  blockTypes?: BlockType[];
  nodeIds?: string[];
  ttlMs?: number;
}

export const DEFAULT_HIGHLIGHT_TTL_MS = 2500;

export function highlightTtl(h: Highlight): number {
  return h.ttlMs ?? DEFAULT_HIGHLIGHT_TTL_MS;
}

type Listener = (h: Highlight) => void;

const listeners = new Set<Listener>();

export const highlightBus: {
  emit(h: Highlight): void;
  subscribe(cb: (h: Highlight) => void): () => void;
} = {
  emit(h) {
    // Copy first so a listener that unsubscribes mid-emit can't skip its neighbours.
    for (const listener of [...listeners]) listener(h);
  },
  subscribe(cb) {
    // Wrap so two subscriptions of one callback stay independent.
    const listener: Listener = (h) => {
      cb(h);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
