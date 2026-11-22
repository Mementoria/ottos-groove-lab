import { useEffect, useRef } from 'react';

export interface ScopeProps {
  analyser: () => AnalyserNode | null;
  mode: 'scope' | 'spectrum';
}

const MIN_HZ = 30;
const MAX_HZ = 16000;
const MIN_DB = -100;
const MAX_DB = -20;
const LINE = '#6ee7b7';

/** Maps a frequency to 0..1 along a log axis from MIN_HZ to MAX_HZ. */
function logPosition(hz: number): number {
  return Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ);
}

function drawFlat(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

function drawScope(
  ctx: CanvasRenderingContext2D,
  node: AnalyserNode,
  data: Float32Array<ArrayBuffer>,
  w: number,
  h: number,
): void {
  node.getFloatTimeDomainData(data);
  ctx.beginPath();
  for (let i = 0; i < data.length; i += 1) {
    const x = (i / (data.length - 1)) * w;
    const y = h / 2 - (data[i] ?? 0) * (h / 2) * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  node: AnalyserNode,
  data: Float32Array<ArrayBuffer>,
  w: number,
  h: number,
): void {
  node.getFloatFrequencyData(data);
  const binHz = node.context.sampleRate / node.fftSize;
  ctx.beginPath();
  let started = false;
  for (let i = 1; i < data.length; i += 1) {
    const hz = i * binHz;
    if (hz < MIN_HZ || hz > MAX_HZ) continue;
    const x = logPosition(hz) * w;
    const level = ((data[i] ?? MIN_DB) - MIN_DB) / (MAX_DB - MIN_DB);
    const y = h - Math.min(1, Math.max(0, level)) * h * 0.95;
    if (started) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      started = true;
    }
  }
  ctx.stroke();
}

export function Scope({ analyser, mode }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ analyser, mode });
  useEffect(() => {
    latest.current = { analyser, mode };
  }, [analyser, mode]);

  useEffect(() => {
    let frame = 0;
    let buffer: Float32Array<ArrayBuffer> | null = null;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d') ?? null;
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = LINE;

      const { analyser: getAnalyser, mode: currentMode } = latest.current;
      const node = getAnalyser();
      if (!node) {
        drawFlat(ctx, w, h);
        return;
      }
      const size = currentMode === 'scope' ? node.fftSize : node.frequencyBinCount;
      if (buffer?.length !== size) buffer = new Float32Array(size);
      if (currentMode === 'scope') drawScope(ctx, node, buffer, w, h);
      else drawSpectrum(ctx, node, buffer, w, h);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="stage-scope"
      role="img"
      aria-label={mode === 'scope' ? 'Sound wave' : 'Sound spectrum'}
    />
  );
}
