import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SONG_STYLES } from '../lessons/content/styles';
import type { Lesson } from '../lessons/types';
import { ArmGlyph } from '../otto/ArmGlyph';
import { loadState, resetState, type SavedState } from './storage';

const STUDIO: Lesson['module'] = 'acid';

const MODULES: readonly { module: Lesson['module']; title: string }[] = [
  { module: 0, title: 'Module 0 · Hello, Otto' },
  { module: 1, title: 'Module 1 · Rhythm' },
  { module: 2, title: 'Module 2 · Sound design' },
  { module: STUDIO, title: 'Song Studio' },
];

export interface CourseMapProps {
  lessons: Lesson[];
  onOpen: (index: number) => void;
}

function isDone(saved: SavedState, lesson: Lesson | undefined): boolean {
  return lesson !== undefined && saved.lessonProgress[lesson.id]?.completed === true;
}

function statusText(saved: SavedState, lesson: Lesson, unlocked: boolean): string {
  if (!unlocked) return '🔒 Locked';
  const progress = saved.lessonProgress[lesson.id];
  if (progress?.completed) return '✓ Done';
  if (progress && progress.stepIndex > 0) {
    return `Step ${String(progress.stepIndex + 1)} of ${String(lesson.steps.length)}`;
  }
  return 'Start';
}

/** Lessons in course order, grouped by module; each unlocks when the one before is done. */
export function CourseMap({ lessons, onOpen }: CourseMapProps) {
  const [saved, setSaved] = useState(loadState);
  const [confirming, setConfirming] = useState(false);
  const resetButton = useRef<HTMLButtonElement>(null);
  const mapContent = useRef<HTMLDivElement>(null);
  const wasConfirming = useRef(false);

  // While the dialog is open, nothing behind it can be focused or clicked.
  useLayoutEffect(() => {
    mapContent.current?.toggleAttribute('inert', confirming);
    // Focus can only return to the map once it is no longer inert.
    if (wasConfirming.current && !confirming) resetButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const closeDialog = () => {
    setConfirming(false);
  };

  const indexed = lessons.map((lesson, index) => ({ lesson, index }));

  const lessonCard = (lesson: Lesson, index: number, arm?: number) => {
    const unlocked = index === 0 || isDone(saved, lessons[index - 1]);
    return (
      <li key={lesson.id}>
        <button
          type="button"
          className="map-card"
          disabled={!unlocked}
          onClick={() => {
            onOpen(index);
          }}
        >
          {arm !== undefined && <ArmGlyph arm={arm} />}
          <span className="map-card-title">{lesson.title}</span>
          <span className="map-card-status">{statusText(saved, lesson, unlocked)}</span>
        </button>
      </li>
    );
  };

  /** One card per style, held by its arm: its lesson if it has one, else "coming soon". */
  const studioCards = (entries: { lesson: Lesson; index: number }[]) => {
    const styled = new Set(SONG_STYLES.flatMap((style) => style.lessonId ?? []));
    const loose = entries.filter((e) => !styled.has(e.lesson.id));
    return [
      ...SONG_STYLES.map((style) => {
        const entry = entries.find((e) => e.lesson.id === style.lessonId);
        if (entry) return lessonCard(entry.lesson, entry.index, style.arm);
        return (
          <li key={style.id}>
            <button type="button" className="map-card map-card-soon" disabled>
              <ArmGlyph arm={style.arm} />
              <span className="map-card-title">{style.name}</span>
              <span className="map-card-status">Coming soon</span>
            </button>
          </li>
        );
      }),
      ...loose.map(({ lesson, index }) => lessonCard(lesson, index)),
    ];
  };

  return (
    <main className="map">
      <div ref={mapContent}>
        <header className="map-header">
          <h1 className="map-title">Otto&apos;s Groove Lab</h1>
          <button
            ref={resetButton}
            type="button"
            className="app-btn"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Reset progress
          </button>
        </header>

        {lessons.length === 0 ? (
          <p className="map-empty">Lessons coming soon</p>
        ) : (
          MODULES.map(({ module, title }) => {
            const entries = indexed.filter((e) => e.lesson.module === module);
            const studio = module === STUDIO;
            if (entries.length === 0 && !studio) return null;
            const headingId = `map-module-${String(module)}`;
            return (
              <section key={headingId} className="map-module" aria-labelledby={headingId}>
                <h2 id={headingId} className="map-module-title">
                  {title}
                </h2>
                <ul className="map-cards">
                  {studio
                    ? studioCards(entries)
                    : entries.map(({ lesson, index }) => lessonCard(lesson, index))}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {confirming && (
        <ResetDialog
          onCancel={closeDialog}
          onConfirm={() => {
            resetState();
            setSaved(loadState());
            closeDialog();
          }}
        />
      )}
    </main>
  );
}

interface ResetDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ResetDialog({ onCancel, onConfirm }: ResetDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // On the document, so Escape and Tab work wherever focus has wandered (e.g. to the body).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first || !last) return;
      const focused = document.activeElement;
      // Wrap around at either end, and pull focus back in from anywhere else.
      const edge = event.shiftKey ? first : last;
      if (dialog.contains(focused) && focused !== edge) return;
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        aria-describedby="reset-desc"
      >
        <h2 id="reset-title" className="dialog-title">
          Reset all progress?
        </h2>
        <p id="reset-desc">
          This clears your finished lessons and saved blocks. It can&apos;t be undone.
        </p>
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="app-btn" onClick={onCancel}>
            Keep my progress
          </button>
          <button type="button" className="app-btn app-btn-danger" onClick={onConfirm}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
