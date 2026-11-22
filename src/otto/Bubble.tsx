import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface BubbleProps {
  lines: string[];
  onDone: () => void;
  actions?: { label: string; onClick: () => void }[];
}

/** Turns `**x**` into <code>x</code>; everything else stays plain text (never HTML). */
function renderLine(line: string): ReactNode[] {
  return line.split('**').map((part, i) =>
    i % 2 === 1 ? <code key={i}>{part}</code> : part,
  );
}

export function Bubble({ lines, onDone, actions }: BubbleProps) {
  const [index, setIndex] = useState(0);
  const [prevLines, setPrevLines] = useState(lines);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  if (prevLines !== lines) {
    setPrevLines(lines);
    setIndex(0);
  }

  const last = Math.max(0, lines.length - 1);
  const atEnd = index >= last;

  useEffect(() => {
    if (atEnd) onDoneRef.current();
  }, [atEnd, lines]);

  return (
    <div className="otto-bubble" role="status" aria-live="polite">
      <p className="otto-bubble-line">{renderLine(lines[Math.min(index, last)] ?? '')}</p>
      {atEnd ? (
        actions && actions.length > 0 && (
          <div className="otto-bubble-actions">
            {actions.map((a) => (
              <button key={a.label} type="button" onClick={a.onClick}>
                {a.label}
              </button>
            ))}
          </div>
        )
      ) : (
        <button type="button" className="otto-bubble-next" aria-label="Next" onClick={() => {
            setIndex(index + 1);
          }}>
          →
        </button>
      )}
    </div>
  );
}
