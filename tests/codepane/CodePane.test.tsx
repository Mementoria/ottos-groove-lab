import { tags } from '@lezer/highlight';
import type { Fraction, Hap, Pattern } from '@strudel/core';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EvalInfo } from '../../src/audio/engine';
import { CodePane } from '../../src/codepane/CodePane';
import { codeHighlightStyle } from '../../src/codepane/highlightStyle';
import { highlightBus } from '../../src/otto/highlightBus';
import { layer, program, sound } from '../../src/program/build';
import { toStrudelCode, type Generated } from '../../src/program/codegen';

function kickGenerated(): { generated: Generated; sourceId: string } {
  const kick = layer(sound('bd sd'));
  return { generated: toStrudelCode(program(null, kick)), sourceId: kick.source.id };
}

function editorText(container: HTMLElement): string {
  return container.querySelector('.cm-content')?.textContent ?? '';
}

function frac(n: number): Fraction {
  return {
    sub: (amount) => frac(n - amount),
    mul: (factor) => frac(n * factor),
    mod: (divisor) => frac(n % divisor),
    valueOf: () => n,
  };
}

type LocatedHap = Hap & { context: { locations: { start: number; end: number }[] } };

function hapAt(start: number, end: number): LocatedHap {
  return {
    whole: { begin: frac(1.5), end: frac(2) },
    value: { s: 'bd' },
    hasOnset: () => true,
    context: { locations: [{ start, end }] },
  };
}

function fakePattern(haps: Hap[] = []) {
  const queryArc = vi.fn<(begin: number, end: number) => Hap[]>(() => haps);
  const pattern: Pattern = { queryArc };
  return { pattern, queryArc };
}

const stopped = () => 0;

describe('CodePane', () => {
  it('hides the code in collapsed mode until "peek at the code" is clicked', async () => {
    const { generated } = kickGenerated();
    const { container } = render(
      <CodePane generated={generated} mode="collapsed" evalInfo={null} cyclePosition={stopped} />,
    );
    expect(container).not.toHaveTextContent('$: s(');

    await userEvent.click(screen.getByRole('button', { name: 'peek at the code' }));

    expect(editorText(container)).toContain('$: s(');
  });

  it('reports peeking changes', async () => {
    const { generated } = kickGenerated();
    const onPeekingChange = vi.fn();
    render(
      <CodePane
        generated={generated}
        mode="collapsed"
        evalInfo={null}
        cyclePosition={stopped}
        onPeekingChange={onPeekingChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'peek at the code' }));
    await userEvent.click(screen.getByRole('button', { name: 'hide the code' }));
    expect(onPeekingChange.mock.calls).toEqual([[true], [false]]);
  });

  it('shows the code in readonly mode', () => {
    const { generated } = kickGenerated();
    const { container } = render(
      <CodePane generated={generated} mode="readonly" evalInfo={null} cyclePosition={stopped} />,
    );
    expect(editorText(container)).toContain('$: s(');
    expect(screen.queryByRole('button', { name: 'peek at the code' })).not.toBeInTheDocument();
  });

  it('colours the code: the mini-notation string gets the string highlight class', async () => {
    const { generated } = kickGenerated();
    const { container } = render(
      <CodePane generated={generated} mode="readonly" evalInfo={null} cyclePosition={stopped} />,
    );
    const stringClass = codeHighlightStyle.style([tags.string]);
    expect(stringClass).toBeTruthy();
    await waitFor(() => {
      const spans = [...container.querySelectorAll('.cm-content span')];
      const mini = spans.find((span) => span.textContent === '"bd sd"');
      expect(mini?.className).toContain(stringClass ?? '');
    });
  });

  it('replaces the document when the generated code changes', () => {
    const { generated } = kickGenerated();
    const { container, rerender } = render(
      <CodePane generated={generated} mode="readonly" evalInfo={null} cyclePosition={stopped} />,
    );
    const next = toStrudelCode(program(120, layer(sound('hh*8'))));
    rerender(<CodePane generated={next} mode="readonly" evalInfo={null} cyclePosition={stopped} />);
    expect(editorText(container)).toContain('setcpm(120/4)');
    expect(editorText(container)).toContain('hh*8');
    expect(editorText(container)).not.toContain('bd sd');
  });

  it('glows the spans of highlighted nodes, then clears them after the ttl', async () => {
    const { generated, sourceId } = kickGenerated();
    const { container } = render(
      <CodePane generated={generated} mode="readonly" evalInfo={null} cyclePosition={stopped} />,
    );

    act(() => {
      highlightBus.emit({ nodeIds: [sourceId, 'not-a-node'], ttlMs: 30 });
    });

    expect(container.querySelector('.ogl-glow')?.textContent).toBe('s("bd sd")');
    await waitFor(() => {
      expect(container.querySelector('.ogl-glow')).toBeNull();
    });
  });

  it('queries the pattern every frame while playing and flashes the active notes', async () => {
    const { generated } = kickGenerated();
    const start = generated.code.indexOf('bd');
    const { pattern, queryArc } = fakePattern([hapAt(start, start + 2)]);
    const evalInfo: EvalInfo = { pattern, miniLocations: [[start, start + 2]] };
    const { container } = render(
      <CodePane
        generated={generated}
        mode="readonly"
        evalInfo={evalInfo}
        cyclePosition={() => 2}
      />,
    );

    await waitFor(() => {
      expect(queryArc).toHaveBeenCalled();
    });
    const [begin, end] = queryArc.mock.calls[0] ?? [];
    expect(begin).toBeCloseTo(1.95);
    expect(end).toBe(2);
    await waitFor(() => {
      expect(container.querySelector('.cm-content [style*="outline"]')?.textContent).toBe('bd');
    });
  });

  it('does not query the pattern while stopped or without an evaluation', async () => {
    const { generated } = kickGenerated();
    const { pattern, queryArc } = fakePattern();
    const { rerender } = render(
      <CodePane generated={generated} mode="readonly" evalInfo={null} cyclePosition={() => 2} />,
    );
    rerender(
      <CodePane
        generated={generated}
        mode="readonly"
        evalInfo={{ pattern, miniLocations: [] }}
        cyclePosition={stopped}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryArc).not.toHaveBeenCalled();
  });

  it('stops the frame loop on unmount', async () => {
    const { generated } = kickGenerated();
    const { pattern, queryArc } = fakePattern();
    const { unmount } = render(
      <CodePane
        generated={generated}
        mode="readonly"
        evalInfo={{ pattern, miniLocations: [] }}
        cyclePosition={() => 1}
      />,
    );
    await waitFor(() => {
      expect(queryArc).toHaveBeenCalled();
    });
    unmount();
    const calls = queryArc.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queryArc.mock.calls.length).toBe(calls);
  });
});
