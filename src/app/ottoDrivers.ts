import type { AudioEngine } from '../audio/engine';
import { rms } from '../otto/motion';

/** One idle sway every two seconds when nothing is playing. */
const IDLE_BEAT_MS = 2000;
const BEATS_PER_CYCLE = 4;
/** Typical output RMS is around 0.05–0.2; this puts it into Otto's 0..1 range. */
export const LEVEL_GAIN = 4;

/** Loudness for Otto's motion: boosted RMS, clamped to 1. */
export function levelFromRms(value: number): number {
  return Math.min(1, value * LEVEL_GAIN);
}

export interface OttoDrivers {
  /** Output loudness (boosted), 0..1. */
  level: () => number;
  /** Position within the current beat, 0..1. */
  beatPhase: () => number;
}

const fraction = (x: number): number => x - Math.floor(x);

/** Otto's per-frame inputs from the engine. Reuses one sample buffer across frames. */
export function createOttoDrivers(
  engine: AudioEngine,
  clock: () => number = () => performance.now(),
): OttoDrivers {
  let buffer: Float32Array<ArrayBuffer> | null = null;
  return {
    level() {
      const node = engine.analyser();
      if (node === null || !engine.isPlaying()) return 0;
      if (buffer === null || buffer.length !== node.fftSize) {
        buffer = new Float32Array(node.fftSize);
      }
      node.getFloatTimeDomainData(buffer);
      return levelFromRms(rms(buffer));
    },
    beatPhase() {
      if (engine.isPlaying()) return fraction(engine.cyclePosition() * BEATS_PER_CYCLE);
      return fraction(clock() / IDLE_BEAT_MS);
    },
  };
}
