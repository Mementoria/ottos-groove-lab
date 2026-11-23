/** Pure math for Otto's motion. No DOM, no React. */

/** Root-mean-square of a sample buffer, 0..1 for samples in -1..1. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.min(1, Math.sqrt(sum / samples.length));
}

/** Rest shape of each tentacle in a 130x130 box: start, control, end (from the approved mockup). */
const TENTACLES: readonly (readonly [number, number, number, number, number, number])[] = [
  [40, 70, 20, 95, 10, 90],
  [45, 78, 35, 110, 22, 115],
  [55, 82, 52, 115, 42, 124],
  [62, 84, 64, 118, 58, 126],
  [68, 84, 70, 118, 78, 126],
  [75, 82, 82, 115, 94, 122],
  [85, 78, 98, 108, 112, 112],
  [90, 70, 110, 92, 122, 86],
];

export const TENTACLE_COUNT = TENTACLES.length;

const SWAY_PX = 9;
const RAISE_PX = 38;

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * SVG path `d` for tentacle `index` (0..7). `beatPhase` is in cycles (fractional part is used),
 * `level` is 0..1 loudness. Amplitude scales with 0.3 + 0.7 * level; each tentacle is offset by
 * index * PI/4. `raise` (0..1) lifts the tips, used for cheering. `rootLift` (px) raises the root
 * with the body as it bobs, leaving the tip planted, so the arm stretches instead of detaching.
 */
export function tentaclePath(
  index: number,
  beatPhase: number,
  level: number,
  raise = 0,
  rootLift = 0,
): string {
  const shape = TENTACLES[((index % 8) + 8) % 8] ?? TENTACLES[0];
  const [sx, sy, cx, cy, ex, ey] = shape ?? [0, 0, 0, 0, 0, 0];
  const amplitude = SWAY_PX * (0.3 + 0.7 * Math.min(1, Math.max(0, level)));
  const angle = 2 * Math.PI * beatPhase + (index * Math.PI) / 4;
  const sway = Math.sin(angle) * amplitude;
  const lift = RAISE_PX * Math.min(1, Math.max(0, raise));
  const ctlX = cx + sway * 0.5;
  const ctlY = cy - lift * 0.6 - rootLift * 0.5;
  const endX = ex + sway;
  const endY = ey - lift + Math.cos(angle) * amplitude * 0.3;
  return `M${fmt(sx)} ${fmt(sy - rootLift)} Q${fmt(ctlX)} ${fmt(ctlY)} ${fmt(endX)} ${fmt(endY)}`;
}

/** Vertical body bob in px, 0..8; a pulse each beat that grows with level. */
export function bobOffset(beatPhase: number, level: number): number {
  const l = Math.min(1, Math.max(0, level));
  const pulse = (1 + Math.cos(2 * Math.PI * beatPhase)) / 2; // 1 on the beat, 0 between
  return 8 * l * pulse;
}
