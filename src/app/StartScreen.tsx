import { Otto } from '../otto/Otto';

const still = () => 0;

export interface StartScreenProps {
  waking: boolean;
  onWake: () => void;
}

/** Otto asleep. Waking him is the user gesture that lets the browser start audio. */
export function StartScreen({ waking, onWake }: StartScreenProps) {
  return (
    <main className="start">
      <h1 className="start-title">Otto&apos;s Groove Lab</h1>
      <div className="start-otto">
        <Otto beatPhase={still} level={still} mood={waking ? 'idle' : 'asleep'} />
        {!waking && (
          <span className="start-zzz" aria-hidden="true">
            z z z
          </span>
        )}
      </div>
      <button type="button" className="app-btn app-btn-main" disabled={waking} onClick={onWake}>
        {waking ? 'Waking Otto…' : 'Click to wake Otto'}
      </button>
    </main>
  );
}
