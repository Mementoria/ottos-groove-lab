import * as Blockly from 'blockly';
import { useEffect, useRef } from 'react';
import { highlightBus, highlightTtl, type Highlight } from '../otto/highlightBus';
import type { Program } from '../program/types';
import { registerBlocks, type BlockType } from './blockTypes';
import {
  owningNodeId,
  programToWorkspaceState,
  workspaceToProgram,
  type ConvertWarning,
} from './convert';
import { oglTheme, type Category } from './theme';
import { buildToolbox, categoryOfTypes } from './toolbox';
import './blocksPane.css';

/**
 * What the workspace starts with: a Program, saved Blockly JSON, or nothing. Saved JSON carries
 * a fallback program (the step's start) for when it won't load.
 */
export type BlocksPaneInitial =
  | { kind: 'program'; program: Program }
  | { kind: 'saved'; state: object; fallback: Program | null }
  | null;

export interface LoadRequest {
  program: Program;
  nonce: number;
  keepUndo: boolean;
}

export interface BlocksPaneChange {
  program: Program;
  warnings: ConvertWarning[];
  state: object;
}

export interface BlocksPaneProps {
  unlocked: BlockType[];
  /** Read once, when the workspace is created. */
  initial: BlocksPaneInitial;
  onChange(result: BlocksPaneChange): void;
  /**
   * "Show me" and step start: each new nonce replaces the workspace with the program. With
   * `keepUndo` ("Show me"), undo steps back to what was there before.
   */
  loadRequest: LoadRequest | null;
  /** Warnings found outside conversion (a pattern typo from playback), shown alongside its own. */
  extraWarnings: readonly ConvertWarning[];
}

/** `workspaces.load` has no try/finally, so a throw leaves its global state behind. Undo that. */
function recoverFromFailedLoad(ws: Blockly.Workspace): void {
  Blockly.Events.setGroup(false);
  Blockly.Events.setRecordUndo(true);
  Blockly.utils.dom.stopTextWidthCache();
  if (ws instanceof Blockly.WorkspaceSvg) ws.setResizesEnabled(true);
  ws.clear();
}

/**
 * Replaces the workspace contents. Saved state that won't load (e.g. it names a block type that
 * no longer exists) loads its fallback instead (or leaves the workspace empty) and logs a
 * console warning instead of an error.
 * Undo is cleared, unless `keepUndo` makes the load itself one undoable step.
 */
export function loadWorkspace(
  ws: Blockly.Workspace,
  initial: BlocksPaneInitial,
  { keepUndo = false }: { keepUndo?: boolean } = {},
): void {
  if (initial === null) {
    ws.clear();
  } else if (initial.kind === 'program') {
    const state = programToWorkspaceState(initial.program);
    // The load is one event group, so with keepUndo a single undo restores what was there.
    Blockly.serialization.workspaces.load(state, ws, { recordUndo: keepUndo });
    if (keepUndo) return;
  } else {
    try {
      Blockly.serialization.workspaces.load(initial.state, ws);
    } catch (error) {
      console.warn('Saved blocks could not be loaded; starting over from the step.', error);
      recoverFromFailedLoad(ws);
      if (initial.fallback) {
        const state = programToWorkspaceState(initial.fallback);
        Blockly.serialization.workspaces.load(state, ws, { recordUndo: false });
      }
    }
  }
  // Undo shouldn't step back across a load (into the previous lesson, say).
  ws.clearUndo();
}

/** Sets each block's warnings (one per line) and clears blocks that had some last time. */
function applyWarnings(
  ws: Blockly.WorkspaceSvg,
  warnings: readonly ConvertWarning[],
  previous: ReadonlySet<string>,
): Set<string> {
  const byBlock = new Map<string, string[]>();
  for (const { blockId, message } of warnings) {
    byBlock.set(blockId, [...(byBlock.get(blockId) ?? []), message]);
  }
  for (const id of previous) {
    if (!byBlock.has(id)) ws.getBlockById(id)?.setWarningText(null);
  }
  for (const [id, messages] of byBlock) ws.getBlockById(id)?.setWarningText(messages.join('\n'));
  return new Set(byBlock.keys());
}

const toolboxKey = (unlocked: readonly BlockType[]) => unlocked.join(' ');

const PULSE_CLASS = 'ogl-hint-pulse';

/**
 * "Look here" in the palette: opens the category so its flyout shows the hinted blocks, glows
 * them there, and pulses the category row. Returns an undo for when the highlight expires,
 * which also closes the flyout again if the hint opened it and it is still showing.
 */
function pointAtPalette(
  ws: Blockly.WorkspaceSvg,
  category: Category,
  types: ReadonlySet<string>,
): (() => void) | null {
  const toolbox = ws.getToolbox();
  if (!(toolbox instanceof Blockly.Toolbox)) return null;
  const item = toolbox
    .getToolboxItems()
    .find(
      (candidate): candidate is Blockly.ToolboxCategory =>
        candidate instanceof Blockly.ToolboxCategory && candidate.getName() === category,
    );
  if (!item) return null;
  // Selecting the already-selected category would close it.
  const opened = toolbox.getSelectedItem() !== item;
  if (opened) toolbox.setSelectedItem(item);

  const container = item.getDiv();
  container?.classList.add(PULSE_CLASS);

  // The flyout fills after selection settles, so glow its blocks once that has happened.
  const flyoutWs = toolbox.getFlyout()?.getWorkspace();
  let shown: Blockly.BlockSvg[] = [];
  const settle = setTimeout(() => {
    shown = (flyoutWs?.getAllBlocks(false) ?? []).filter((b) => types.has(b.type));
    for (const block of shown) flyoutWs?.highlightBlock(block.id, true);
  }, 0);

  return () => {
    clearTimeout(settle);
    container?.classList.remove(PULSE_CLASS);
    // The flyout may have been refilled since; skip blocks it has disposed of.
    for (const block of shown) if (!block.isDisposed()) flyoutWs?.highlightBlock(block.id, false);
    // Close what the hint opened, unless the learner has moved on to another category.
    if (opened && toolbox.getSelectedItem() === item) toolbox.clearSelection();
  };
}

/** The Blockly workspace. Reports every (non-UI) change as a Program plus warnings and state. */
export function BlocksPane(props: BlocksPaneProps) {
  const { unlocked, loadRequest, extraWarnings } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  // The latest props, for the workspace's long-lived listeners (and its creation).
  const propsRef = useRef(props);
  const toolboxKeyRef = useRef<string | null>(null);
  const appliedNonceRef = useRef<number | null>(null);
  /** Re-applies conversion and extra warnings together; set while the workspace exists. */
  const refreshWarningsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Registers the step-grid field's CSS, which must happen before the first inject.
    registerBlocks();
    const ws = Blockly.inject(host, {
      renderer: 'zelos',
      theme: oglTheme(),
      toolbox: buildToolbox(propsRef.current.unlocked),
      trashcan: true,
      zoom: { controls: true },
    });
    wsRef.current = ws;
    toolboxKeyRef.current = toolboxKey(propsRef.current.unlocked);

    let disposed = false;
    let warned = new Set<string>();
    let converted: readonly ConvertWarning[] = [];
    const refreshWarnings = () => {
      warned = applyWarnings(ws, [...converted, ...propsRef.current.extraWarnings], warned);
    };
    refreshWarningsRef.current = refreshWarnings;
    let flushQueued = false;
    // Blockly fires events in batches (a drop or a load is many events); report once per batch.
    const flush = () => {
      flushQueued = false;
      if (disposed) return;
      const { program, warnings } = workspaceToProgram(ws);
      converted = warnings;
      refreshWarnings();
      propsRef.current.onChange({
        program,
        warnings,
        state: Blockly.serialization.workspaces.save(ws),
      });
    };
    // Touching a block glows its code. The block itself needs no extra glow, so our own
    // highlights are skipped by the subscriber below.
    const ownHighlights = new WeakSet<Highlight>();
    const onSelected = (event: Blockly.Events.Selected) => {
      if (!event.newElementId) return;
      const nodeId = owningNodeId(ws, event.newElementId);
      if (nodeId === null) return;
      const highlight: Highlight = { nodeIds: [nodeId] };
      ownHighlights.add(highlight);
      highlightBus.emit(highlight);
    };
    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      if (event instanceof Blockly.Events.Selected) onSelected(event);
      if (event.isUiEvent || flushQueued) return;
      flushQueued = true;
      queueMicrotask(flush);
    };
    ws.addChangeListener(Blockly.Events.disableOrphans);
    ws.addChangeListener(onWorkspaceChange);

    // Highlights are counted per block so overlapping ones don't cut each other short.
    const lit = new Map<string, number>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = highlightBus.subscribe((h) => {
      if (ownHighlights.has(h)) return;
      const types = new Set(h.blockTypes ?? []);
      const ids = new Set(h.nodeIds ?? []);
      const targets = ws
        .getAllBlocks(false)
        .filter((block) => types.has(block.type) || ids.has(block.id))
        .map((block) => block.id);
      const category = categoryOfTypes(h.blockTypes ?? []);
      const undoPalette = category === null ? null : pointAtPalette(ws, category, types);
      if (undoPalette) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          undoPalette();
        }, highlightTtl(h));
        timers.add(timer);
      }
      if (targets.length === 0) return;
      for (const id of targets) {
        lit.set(id, (lit.get(id) ?? 0) + 1);
        ws.highlightBlock(id, true);
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        for (const id of targets) {
          const remaining = (lit.get(id) ?? 1) - 1;
          if (remaining > 0) {
            lit.set(id, remaining);
          } else {
            lit.delete(id);
            ws.highlightBlock(id, false);
          }
        }
      }, highlightTtl(h));
      timers.add(timer);
    });

    // Blockly only tracks window resizes; the pane can also change size with the layout.
    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(ws);
    });
    resizeObserver.observe(host);

    loadWorkspace(ws, propsRef.current.initial);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      ws.dispose();
      wsRef.current = null;
      refreshWarningsRef.current = null;
      // A re-created workspace (StrictMode re-runs effects) must apply the load request again.
      appliedNonceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ws = wsRef.current;
    const key = toolboxKey(unlocked);
    if (!ws || key === toolboxKeyRef.current) return;
    ws.updateToolbox(buildToolbox(unlocked));
    toolboxKeyRef.current = key;
  }, [unlocked]);

  useEffect(() => {
    refreshWarningsRef.current?.();
  }, [extraWarnings]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !loadRequest || loadRequest.nonce === appliedNonceRef.current) return;
    appliedNonceRef.current = loadRequest.nonce;
    loadWorkspace(
      ws,
      { kind: 'program', program: loadRequest.program },
      { keepUndo: loadRequest.keepUndo },
    );
  }, [loadRequest]);

  return <div ref={hostRef} className="ogl-blockspane" style={{ width: '100%', height: '100%' }} />;
}
