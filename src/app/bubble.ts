import { allowsManualNext } from '../lessons/runner';
import type { Step } from '../lessons/types';
import type { BubbleProps } from '../otto/Bubble';
import type { LessonSession } from './useLessonSession';

export const OFFER_LINE = 'Want a hint?';

export type BubbleSource = Pick<
  LessonSession,
  'runner' | 'speech' | 'hasNextLesson' | 'acceptOffer' | 'dismissOffer' | 'manualNext'
>;

export interface Presentation {
  /** New for every presentation, so the bubble replays even identical lines. */
  key: string;
  lines: string[];
  actions?: BubbleProps['actions'];
}

/** What Otto's bubble shows: an offer interrupts; otherwise the session's speech plus actions. */
export function presentBubble(
  s: BubbleSource,
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
  if (allowsManualNext(step)) {
    return { ...s.speech, actions: [{ label: 'Sounds right to me →', onClick: s.manualNext }] };
  }
  return { key: s.speech.key, lines: s.speech.lines };
}
