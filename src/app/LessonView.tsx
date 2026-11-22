import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AudioEngine, EngineStatus } from '../audio/engine';
import { BlocksPane } from '../blocks/BlocksPane';
import { CodePane } from '../codepane/CodePane';
import type { Lesson, Step } from '../lessons/types';
import type { BubbleProps } from '../otto/Bubble';
import { Stage } from '../stage/Stage';
import { createOttoDrivers } from './ottoDrivers';
import { copyCode, strudelUrl } from './share';
import { useLessonSession, type LessonSession } from './useLessonSession';

const OFFER_LINE = 'Want a hint?';
const COPY_FEEDBACK_MS = 2000;

export interface LessonViewProps {
  engine: AudioEngine;
  lessons: Lesson[];
  index: number;
  onBack: () => void;
  onNext: () => void;
}

function useEngineStatus(engine: AudioEngine): EngineStatus {
  const subscribe = useCallback(
    (cb: () => void) =>
      engine.onStatus(() => {
        cb();
      }),
    [engine],
  );
  const getStatus = useCallback(() => engine.status(), [engine]);
  return useSyncExternalStore(subscribe, getStatus);
}

interface Presentation {
  key: string;
  lines: string[];
  actions?: BubbleProps['actions'];
}

/** What the bubble shows: an offer interrupts; otherwise the session's speech plus actions. */
function present(
  s: LessonSession,
  step: Step | undefined,
  nav: { onNext: () => void; onBack: () => void },
): Presentation {
  if (s.runner.completed) {
    const back = { label: 'Back to map', onClick: nav.onBack };
    return {
      ...s.speech,
      actions: s.hasNextLesson ? [{ label: 'Next lesson →', onClick: nav.onNext }, back] : [back],
    };
  }
  if (s.runner.offer) {
    return {
      key: `${s.speech.key}:offer`,
      lines: [OFFER_LINE],
      actions: [
        { label: 'Yes please', onClick: s.acceptOffer },
        { label: 'Not yet', onClick: s.dismissOffer },
      ],
    };
  }
  if (step?.check.kind === 'manual') {
    return { ...s.speech, actions: [{ label: 'Sounds right to me →', onClick: s.manualNext }] };
  }
  return s.speech;
}

/** Stage on top; blocks | code below, filling the viewport. Key it by lesson index. */
export function LessonView({ engine, lessons, index, onBack, onNext }: LessonViewProps) {
  const session = useLessonSession(index, { engine, course: lessons });
  const status = useEngineStatus(engine);
  const drivers = useMemo(() => createOttoDrivers(engine), [engine]);
  // Stable references: CodePane and Scope restart their animation loops when these change.
  const cyclePosition = useCallback(() => engine.cyclePosition(), [engine]);
  const analyser = useCallback(() => engine.analyser(), [engine]);
  const [doneKey, setDoneKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copied === 'idle') return;
    const timer = setTimeout(() => {
      setCopied('idle');
    }, COPY_FEEDBACK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const { lesson, runner, generated } = session;
  const step = lesson.steps[runner.stepIndex];
  const bubble = present(session, step, { onNext, onBack });
  const mood = session.cheering ? 'cheer' : doneKey === bubble.key ? 'idle' : 'talking';

  return (
    <div className="lesson">
      <header className="lesson-bar">
        <button type="button" className="app-btn lesson-back" onClick={onBack}>
          ← Back to map
        </button>
        <span className="lesson-title">{lesson.title}</span>
      </header>

      <Stage
        checklist={{
          title: lesson.title,
          labels: lesson.steps.map((s) => s.label),
          current: runner.stepIndex,
          completed: runner.completed ? lesson.steps.length : runner.stepIndex,
        }}
        otto={{ beatPhase: drivers.beatPhase, level: drivers.level, mood }}
        bubble={{
          lines: bubble.lines,
          actions: bubble.actions,
          onDone: () => {
            setDoneKey(bubble.key);
          },
        }}
        bubbleKey={bubble.key}
        scope={{ analyser, mode: 'scope' }}
        spectrumAvailable={lesson.spectrum}
        playing={session.playing}
        onPlay={session.play}
        onStop={session.stop}
        onHint={session.requestHint}
        hintDisabled={runner.completed || step === undefined}
        hasTarget={!runner.completed && step?.target !== undefined}
        targetPlaying={session.targetPlaying}
        onToggleTarget={session.toggleTarget}
        engineError={status === 'error' ? 'The sounds could not load.' : null}
        onRetryAudio={() => {
          void engine.start();
        }}
      />

      <div className="lesson-panes">
        <div className="lesson-blocks">
          <BlocksPane
            unlocked={session.unlocked}
            initial={session.initial}
            onChange={session.onBlocksChange}
            loadRequest={session.loadRequest}
          />
        </div>
        <div className="lesson-code">
          <div className="lesson-code-header">
            <span className="lesson-code-title">Strudel code</span>
            <button
              type="button"
              className="app-btn app-btn-small"
              onClick={() => {
                void copyCode(generated.code).then((ok) => {
                  setCopied(ok ? 'copied' : 'failed');
                });
              }}
            >
              {copied === 'copied'
                ? 'Copied!'
                : copied === 'failed'
                  ? "Couldn't copy"
                  : 'Copy code'}
            </button>
            <a
              className="app-btn app-btn-small"
              href={strudelUrl(generated.code)}
              target="_blank"
              rel="noopener"
            >
              Open in strudel.cc
            </a>
          </div>
          <CodePane
            generated={generated}
            mode={lesson.codePane}
            evalInfo={session.evalInfo}
            cyclePosition={cyclePosition}
          />
        </div>
      </div>
    </div>
  );
}
