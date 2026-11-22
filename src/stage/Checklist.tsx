export interface ChecklistProps {
  title: string;
  labels: string[];
  current: number;
  /** Number of steps finished so far. */
  completed: number;
}

export function Checklist({ title, labels, current, completed }: ChecklistProps) {
  return (
    <section className="stage-checklist" aria-label="Lesson steps">
      <h2 className="stage-checklist-title">{title}</h2>
      <ol className="stage-checklist-list">
        {labels.map((label, i) => {
          const done = i < completed;
          const isCurrent = i === current && !done;
          return (
            <li
              key={String(i) + label}
              className={done ? 'is-done' : isCurrent ? 'is-current' : undefined}
              aria-label={done ? `${label}, done` : undefined}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="stage-checklist-mark" aria-hidden="true">
                {done ? '✓' : i + 1}
              </span>
              <span className="stage-checklist-label">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
