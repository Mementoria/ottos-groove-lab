import { useEffect, useRef } from 'react';
import { bobOffset, tentaclePath, TENTACLE_COUNT } from './motion';

export interface OttoProps {
  beatPhase: () => number;
  level: () => number;
  mood: 'idle' | 'talking' | 'cheer';
}

const JUMP_MS = 600;
const JUMP_PX = 14;
const MOUTH_CLOSED = 'M55 66 Q65 74 75 66';
const MOUTH_OPEN = 'M55 66 Q65 80 75 66';

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function Otto({ beatPhase, level, mood }: OttoProps) {
  const tentacleRefs = useRef<(SVGPathElement | null)[]>([]);
  const bodyRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const moodRef = useRef(mood);
  const cheerStart = useRef<number | null>(null);
  const propsRef = useRef({ beatPhase, level });
  useEffect(() => {
    propsRef.current = { beatPhase, level };
  }, [beatPhase, level]);

  useEffect(() => {
    moodRef.current = mood;
    cheerStart.current = mood === 'cheer' ? performance.now() : null;
  }, [mood]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    let frame = 0;
    const tick = (now: number) => {
      const { beatPhase: phaseFn, level: levelFn } = propsRef.current;
      const m = moodRef.current;
      const phase = phaseFn();
      const lvl = reduced ? 0 : levelFn();

      let jump = 0;
      let raise = 0;
      if (m === 'cheer') {
        raise = 1;
        const start = cheerStart.current;
        if (!reduced && start !== null && now - start < JUMP_MS) {
          jump = JUMP_PX * Math.sin((Math.PI * (now - start)) / JUMP_MS);
        }
      }

      for (let i = 0; i < TENTACLE_COUNT; i += 1) {
        // Reduced motion: hold a near-still pose (minimum amplitude, no phase travel).
        tentacleRefs.current[i]?.setAttribute(
          'd',
          tentaclePath(i, reduced ? 0 : phase, lvl, raise),
        );
      }
      const bob = reduced ? 0 : bobOffset(phase, lvl) * (m === 'talking' ? 1 : 0.6);
      bodyRef.current?.setAttribute('transform', `translate(0 ${(-bob - jump).toFixed(2)})`);
      if (mouthRef.current) {
        const open = m === 'talking' && !reduced && Math.sin(now / 110) > 0;
        mouthRef.current.setAttribute('d', open ? MOUTH_OPEN : MOUTH_CLOSED);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <svg
      className="otto"
      role="img"
      aria-label="Otto the octopus"
      width="130"
      height="130"
      viewBox="0 0 130 130"
    >
      <g stroke="#b06ad8" strokeWidth="7" strokeLinecap="round" fill="none">
        {Array.from({ length: TENTACLE_COUNT }, (_, i) => (
          <path
            key={i}
            ref={(el) => {
              tentacleRefs.current[i] = el;
            }}
            d={tentaclePath(i, 0, 0)}
          />
        ))}
      </g>
      <g ref={bodyRef}>
        <ellipse cx="65" cy="52" rx="34" ry="32" fill="#c784ee" />
        <circle cx="53" cy="50" r="8" fill="#fff" />
        <circle cx="77" cy="50" r="8" fill="#fff" />
        <circle cx="55" cy="51" r="4" fill="#222" />
        <circle cx="79" cy="51" r="4" fill="#222" />
        <path
          ref={mouthRef}
          d={MOUTH_CLOSED}
          stroke="#5a2a78"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="36" y="16" width="58" height="8" rx="4" fill="#333" />
        <circle cx="36" cy="30" r="8" fill="#333" />
        <circle cx="94" cy="30" r="8" fill="#333" />
      </g>
    </svg>
  );
}
