import { tentaclePath, TENTACLE_COUNT } from './motion';

export interface ArmGlyphProps {
  /** The arm (0–7) to light up. */
  arm: number;
}

/** A tiny, still Otto with one arm lit: the Song Studio card for that arm's style. */
export function ArmGlyph({ arm }: ArmGlyphProps) {
  return (
    <svg className="arm-glyph" aria-hidden="true" width="36" height="36" viewBox="0 0 130 130">
      <g strokeWidth="9" strokeLinecap="round" fill="none">
        {Array.from({ length: TENTACLE_COUNT }, (_, i) =>
          i === arm ? null : (
            <path key={i} d={tentaclePath(i, 0, 0)} stroke="#b06ad8" opacity="0.55" />
          ),
        )}
        <path className="arm-glyph-held" d={tentaclePath(arm, 0, 0)} stroke="#6ee7b7" />
      </g>
      <ellipse cx="65" cy="52" rx="34" ry="32" fill="#c784ee" />
      <circle cx="53" cy="50" r="8" fill="#fff" />
      <circle cx="77" cy="50" r="8" fill="#fff" />
      <circle cx="55" cy="51" r="4" fill="#222" />
      <circle cx="79" cy="51" r="4" fill="#222" />
    </svg>
  );
}
