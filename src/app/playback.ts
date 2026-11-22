import type { AudioEngine, EvalInfo } from '../audio/engine';

export interface Playback {
  play: (code: string) => void;
  update: (code: string) => void;
  stop: () => void;
  /** The learner's intent (true from play until stop), not whether sound is coming out yet. */
  wantsPlaying: () => boolean;
  /** Detach for good: drop queued work, report nothing more, and stop any late sound. */
  dispose: () => void;
}

export type OnSettled = (
  code: string,
  info: EvalInfo | null,
  error: Error | null,
  played: boolean,
) => void;

/**
 * One evaluation at a time per engine, across every session using it. Lessons share the app's
 * engine, and a lesson left mid-evaluation would otherwise finish after (and stop or overwrite)
 * the next lesson's playback. Queued on this lock, the old evaluation completes, re-applies its
 * stop, and only then does the new session's play run.
 */
interface EngineLock {
  tail: Promise<void>;
  holders: number;
}

const engineLocks = new WeakMap<AudioEngine, EngineLock>();

function withEngineLock<T>(engine: AudioEngine, run: () => Promise<T>): Promise<T> {
  const lock = engineLocks.get(engine) ?? { tail: Promise.resolve(), holders: 0 };
  engineLocks.set(engine, lock);
  // Uncontended: start right away, so a play reaches the engine within the same tick.
  const result = lock.holders === 0 ? run() : lock.tail.then(run);
  lock.holders += 1;
  const release = (): void => {
    lock.holders -= 1;
  };
  lock.tail = result.then(release, release);
  return result;
}

/**
 * Serialises engine evaluations. Strudel installs a pattern when its evaluation finishes, so two
 * overlapping evaluations could finish out of order and leave the older pattern playing. Here
 * only one is ever in flight; edits that arrive meanwhile collapse into one follow-up with the
 * latest code, and only the result of the latest code is reported.
 */
export function createPlayback(engine: AudioEngine, onSettled: OnSettled): Playback {
  let busy = false;
  let disposed = false;
  let next: { code: string; play: boolean } | null = null;
  let wantPlaying = false;

  // Read through functions: `next` and `disposed` change while `pump` awaits.
  const take = (): { code: string; play: boolean } | null => {
    const job = next;
    next = null;
    return job;
  };
  const queued = (): boolean => next !== null;
  const playQueued = (): boolean => next?.play === true;
  /** Makes the queued job (if any) a play; true if there was one. */
  const carryPlay = (): boolean => {
    if (next === null) return false;
    next = { ...next, play: true };
    return true;
  };
  const isDisposed = (): boolean => disposed;

  async function pump(): Promise<void> {
    busy = true;
    try {
      for (let job = take(); job !== null && !isDisposed(); job = take()) {
        const { code, play } = job;
        const { info, evalError } = await withEngineLock(engine, async () => {
          // Disposed while waiting for the lock: don't make the next session wait on it too.
          if (isDisposed()) return { info: null, evalError: null };
          const couldStart = play || engine.isPlaying();
          let result: EvalInfo | null = null;
          let error: Error | null = null;
          try {
            result = play ? await engine.play(code) : await engine.update(code);
            // Read at once: the engine reports on its latest evaluation, which is this one.
            error = engine.evalError();
          } catch (thrown) {
            console.warn('Evaluation failed.', thrown);
          }
          // The engine marks itself playing (and Strudel starts its clock) after its await, so a
          // stop pressed while this was in flight (or a detach) has to be applied again now,
          // inside the lock, before any other session's evaluation runs.
          if (!wantPlaying && couldStart) engine.stop();
          return { info: result, evalError: error };
        });
        if (isDisposed()) return;
        if (wantPlaying && !engine.isPlaying()) {
          // A Play that failed hands its intent to the edit queued behind it (a fix, say).
          // Otherwise play with nothing to play, or an edit down to silence, ends the intent.
          const carried = play && carryPlay();
          if (!carried && !playQueued()) wantPlaying = false;
        }
        if (!queued()) onSettled(code, info, evalError, play);
      }
    } finally {
      busy = false;
    }
  }

  function kick(): void {
    if (!busy && !disposed) void pump();
  }

  return {
    play(code) {
      if (disposed) return;
      wantPlaying = true;
      next = { code, play: true };
      kick();
    },
    update(code) {
      if (disposed) return;
      next = { code, play: next?.play ?? false };
      kick();
    },
    stop() {
      wantPlaying = false;
      if (next) next = { ...next, play: false };
      engine.stop();
    },
    wantsPlaying: () => wantPlaying,
    dispose() {
      disposed = true;
      wantPlaying = false;
      next = null;
      engine.stop();
    },
  };
}
