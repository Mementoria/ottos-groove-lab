import type { AudioEngine } from '../audio/engine';

/** The longest the start screen waits before moving on regardless. */
export const WAKE_TIMEOUT_MS = 4000;

/**
 * Wakes the engine (call inside the click: audio may only start from a user gesture) and
 * resolves once audio is unlocked, or after WAKE_TIMEOUT_MS, whichever is first. Never rejects:
 * if the sounds then fail to load, the lesson stage shows the error with a Retry.
 */
export function wakeWithin(engine: AudioEngine, timeoutMs = WAKE_TIMEOUT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  const awake = engine.wake().catch((error: unknown) => {
    console.warn('Audio could not start.', error);
  });
  return Promise.race([awake, timeout]).finally(() => {
    clearTimeout(timer);
  });
}
