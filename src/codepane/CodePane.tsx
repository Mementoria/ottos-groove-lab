import { javascript } from '@codemirror/lang-javascript';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import {
  highlightExtension,
  highlightMiniLocations,
  updateMiniLocations,
} from '@strudel/codemirror/highlight.mjs';
import { useEffect, useRef, useState } from 'react';
import type { EvalInfo } from '../audio/engine';
import { highlightBus, highlightTtl } from '../otto/highlightBus';
import type { Generated } from '../program/codegen';
import { codeHighlighting } from './highlightStyle';
import './codePane.css';

export type CodePaneMode = 'collapsed' | 'readonly';

export interface CodePaneProps {
  generated: Generated;
  mode: CodePaneMode;
  evalInfo: EvalInfo | null;
  cyclePosition: () => number;
}

/** How far back (in cycles) each frame looks for sounding haps. */
const FLASH_WINDOW = 0.05;

/* ---------- glow: amber marks over node spans, each removed when its highlight expires ---------- */

interface GlowSpec {
  mark: Decoration;
  ranges: readonly (readonly [number, number])[];
}

const addGlow = StateEffect.define<GlowSpec>();
/** Removes every range of the given mark (marks are compared by identity). */
const removeGlow = StateEffect.define<Decoration>();

const glowField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(glows, tr) {
    let next = glows.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addGlow)) {
        const { mark, ranges } = effect.value;
        const docLength = tr.newDoc.length;
        const add = ranges
          .filter(([from, to]) => from < to && to <= docLength)
          .map(([from, to]) => mark.range(from, to));
        next = next.update({ add, sort: true });
      } else if (effect.is(removeGlow)) {
        const mark = effect.value;
        next = next.update({ filter: (_from, _to, value) => value !== mark });
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function glowMark(ttlMs: number): Decoration {
  // The fade lasts as long as the highlight.
  return Decoration.mark({
    class: 'ogl-glow',
    attributes: { style: `animation-duration: ${String(ttlMs)}ms` },
  });
}

/* ---------- component ---------- */

/** The generated Strudel code: hidden behind a "peek" toggle, or always shown read-only. */
export function CodePane({ generated, mode, evalInfo, cyclePosition }: CodePaneProps) {
  const [peeking, setPeeking] = useState(false);
  const showCode = mode === 'readonly' || peeking;
  return (
    <section className="ogl-codepane" aria-label="Code">
      {mode === 'collapsed' && (
        <button
          type="button"
          className="ogl-codepane-toggle"
          aria-expanded={peeking}
          onClick={() => {
            setPeeking((open) => !open);
          }}
        >
          {peeking ? 'hide the code' : 'peek at the code'}
        </button>
      )}
      {showCode && (
        <CodeView generated={generated} evalInfo={evalInfo} cyclePosition={cyclePosition} />
      )}
    </section>
  );
}

function CodeView({ generated, evalInfo, cyclePosition }: Omit<CodePaneProps, 'mode'>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const spansRef = useRef(generated.spans);

  useEffect(() => {
    spansRef.current = generated.spans;
  }, [generated.spans]);

  // Create the editor once (the document is filled by the effect below).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.lineWrapping,
          javascript(),
          codeHighlighting,
          highlightExtension,
          glowField,
        ],
      }),
    });
    viewRef.current = view;

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = highlightBus.subscribe((h) => {
      const spans = spansRef.current;
      const ranges = (h.nodeIds ?? []).flatMap((id) => {
        const span = spans[id];
        return span ? [span] : [];
      });
      if (ranges.length === 0) return;
      const ttlMs = highlightTtl(h);
      const mark = glowMark(ttlMs);
      view.dispatch({ effects: addGlow.of({ mark, ranges }) });
      const timer = setTimeout(() => {
        timers.delete(timer);
        view.dispatch({ effects: removeGlow.of(mark) });
      }, ttlMs);
      timers.add(timer);
    });

    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Read-only, so the document can simply be replaced: there is no cursor to preserve.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === generated.code) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: generated.code } });
  }, [generated.code]);

  // Declared after the document effect so, when both change together, the locations land on
  // the new code. Not re-applied on code changes alone: the old offsets wouldn't fit it.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    updateMiniLocations(view, evalInfo?.miniLocations ?? []);
  }, [evalInfo]);

  // Active-note flashing: each frame, outline the mini-notation of the haps sounding now.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (!evalInfo) {
      highlightMiniLocations(view, 0, []);
      return;
    }
    const { pattern } = evalInfo;
    let frame = 0;
    let lit = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = cyclePosition();
      if (now > 0) {
        highlightMiniLocations(view, now, pattern.queryArc(now - FLASH_WINDOW, now));
        lit = true;
      } else if (lit) {
        highlightMiniLocations(view, 0, []);
        lit = false;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [evalInfo, cyclePosition]);

  return <div ref={hostRef} className="ogl-codepane-editor" />;
}
