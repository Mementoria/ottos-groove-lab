import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AudioEngine, EngineStatus } from '../audio/engine';
import { BlocksPane } from '../blocks/BlocksPane';
import { typoWarnings } from '../blocks/convert';
import { CodePane } from '../codepane/CodePane';
import type { Lesson } from '../lessons/types';
import { Stage } from '../stage/Stage';
import { createOttoDrivers } from './ottoDrivers';
import { copyCode, strudelUrl } from './share';
import { presentBubble } from './bubble';
import { useLessonSession } from './useLessonSession';

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
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    if (copied === 'idle') return;
    const timer = setTimeout(() => {
      setCopied('idle');
    }, COPY_FEEDBACK_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const { lesson, runner, generated, evalError } = session;
  const extraWarnings = useMemo(() => typoWarnings(evalError?.nodeIds ?? []), [evalError]);
  const step = lesson.steps[runner.stepIndex];
  const bubble = presentBubble(session, step, { onNext, onBack });
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
        soundsLoading={status === 'loading'}
        onRetryAudio={() => {
          void engine.start();
        }}
      />

      {/* Collapsed code gives its width to the blocks (BlocksPane resizes Blockly itself). */}
      <div
        className={
          lesson.codePane === 'collapsed' && !peeking
            ? 'lesson-panes is-code-collapsed'
            : 'lesson-panes'
        }
      >
        <div className="lesson-blocks">
          <BlocksPane
            unlocked={session.unlocked}
            initial={session.initial}
            onChange={session.onBlocksChange}
            loadRequest={session.loadRequest}
            extraWarnings={extraWarnings}
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
            onPeekingChange={setPeeking}
            evalInfo={session.evalInfo}
            cyclePosition={cyclePosition}
          />
        </div>
      </div>
    </div>
  );
}
