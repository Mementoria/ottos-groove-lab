import { useState } from 'react';
import { Bubble, type BubbleProps } from '../otto/Bubble';
import { Otto, type OttoProps } from '../otto/Otto';
import { Checklist, type ChecklistProps } from './Checklist';
import { Scope, type ScopeProps } from './Scope';
import './stage.css';

export interface StageProps {
  checklist: ChecklistProps;
  otto: OttoProps;
  bubble: BubbleProps;
  /** A new key per presentation remounts the bubble, so even repeated lines replay. */
  bubbleKey: string;
  scope: ScopeProps;
  spectrumAvailable: boolean;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onHint: () => void;
  hintDisabled: boolean;
  hasTarget: boolean;
  targetPlaying: boolean;
  onToggleTarget: () => void;
  /** The sounds couldn't load: Otto says so (ERROR_LINE) and offers a retry. */
  engineError: boolean;
  /** Audio is unlocked but samples and soundfonts are still arriving. */
  soundsLoading: boolean;
  onRetryAudio: () => void;
}

const ERROR_LINE = "I can't reach the sound library. Check your connection?";

export function Stage({
  checklist,
  otto,
  bubble,
  bubbleKey,
  scope,
  spectrumAvailable,
  playing,
  onPlay,
  onStop,
  onHint,
  hintDisabled,
  hasTarget,
  targetPlaying,
  onToggleTarget,
  engineError,
  soundsLoading,
  onRetryAudio,
}: StageProps) {
  const [spectrum, setSpectrum] = useState(false);
  const mode = spectrumAvailable && spectrum ? 'spectrum' : 'scope';

  return (
    <div className="stage">
      <Checklist {...checklist} />
      <div className="stage-otto">
        <Otto {...otto} mood={engineError ? 'talking' : otto.mood} />
        {engineError ? (
          <Bubble
            lines={[ERROR_LINE]}
            onDone={() => {}}
            actions={[{ label: 'Retry', onClick: onRetryAudio }]}
          />
        ) : (
          <Bubble key={bubbleKey} {...bubble} />
        )}
      </div>
      <div className="stage-right">
        <Scope analyser={scope.analyser} mode={mode} />
        <div className="stage-controls">
          {playing ? (
            <button
              type="button"
              className="stage-btn stage-btn-main"
              aria-label="Stop"
              onClick={onStop}
            >
              ■
            </button>
          ) : (
            <button
              type="button"
              className="stage-btn stage-btn-main"
              aria-label="Play"
              onClick={onPlay}
            >
              ▶
            </button>
          )}
          <button
            type="button"
            className="stage-btn"
            aria-label="Hint"
            disabled={hintDisabled}
            onClick={onHint}
          >
            💡
          </button>
          {hasTarget && (
            <button
              type="button"
              className="stage-btn stage-btn-text"
              aria-pressed={targetPlaying}
              onClick={onToggleTarget}
            >
              🎧 hear the goal
            </button>
          )}
          {spectrumAvailable && (
            <button
              type="button"
              className="stage-btn stage-btn-text"
              onClick={() => {
                setSpectrum(mode === 'scope');
              }}
            >
              {mode === 'scope' ? 'Spectrum' : 'Scope'}
            </button>
          )}
          {soundsLoading && (
            <span className="stage-loading" role="status">
              Loading sounds…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
