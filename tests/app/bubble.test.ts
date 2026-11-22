import { OFFER_LINE, presentBubble, type BubbleSource } from '../../src/app/bubble';
import { initRunner } from '../../src/lessons/runner';
import type { Step } from '../../src/lessons/types';
import { layer, program, sound } from '../../src/program/build';

function step(type: Step['type'], kind: 'playing' | 'manual'): Step {
  return {
    id: 's',
    label: 's',
    type,
    say: ['hi'],
    check: { kind },
    hints: [{ say: 'a' }, { say: 'b' }],
    solution: program(null, layer(sound('bd'))),
    success: 'yay',
  };
}

const nav = { onNext: () => {}, onBack: () => {} };

function source(overrides: Partial<BubbleSource> = {}): BubbleSource {
  return {
    runner: initRunner(0),
    speech: { key: 'k1', lines: ['Hello'] },
    hasNextLesson: true,
    acceptOffer: () => {},
    dismissOffer: () => {},
    manualNext: () => {},
    ...overrides,
  };
}

const labels = (actions: { label: string }[] | undefined) => (actions ?? []).map((a) => a.label);

describe('presentBubble', () => {
  it('shows the speech alone on a guided step with an automatic check', () => {
    const b = presentBubble(source(), step('guided', 'playing'), nav);
    expect(b).toEqual({ key: 'k1', lines: ['Hello'] });
  });

  it('always offers "Sounds right to me →" on an open step, whatever its check', () => {
    const b = presentBubble(source(), step('open', 'playing'), nav);
    expect(labels(b.actions)).toEqual(['Sounds right to me →']);
  });

  it('offers it on a manual check too', () => {
    const b = presentBubble(source(), step('guided', 'manual'), nav);
    expect(labels(b.actions)).toEqual(['Sounds right to me →']);
  });

  it('interrupts with a hint offer under its own key', () => {
    const b = presentBubble(
      source({ runner: { ...initRunner(0), offer: true } }),
      step('puzzle', 'playing'),
      nav,
    );
    expect(b.lines).toEqual([OFFER_LINE]);
    expect(b.key).toBe('k1:offer');
    expect(labels(b.actions)).toEqual(['Yes please', 'Not yet']);
  });

  it('offers the next lesson on completion, or only the map after the last one', () => {
    const done = { ...initRunner(0), completed: true };
    expect(labels(presentBubble(source({ runner: done }), undefined, nav).actions)).toEqual([
      'Next lesson →',
      'Back to map',
    ]);
    const last = source({ runner: done, hasNextLesson: false });
    expect(labels(presentBubble(last, undefined, nav).actions)).toEqual(['Back to map']);
  });
});
