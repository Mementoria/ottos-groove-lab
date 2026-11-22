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
import { oglTheme } from './theme';
import { buildToolbox } from './toolbox';

/** What the workspace starts with: a Program, saved Blockly JSON, or nothing. */
export type BlocksPaneInitial =
  { kind: 'program'; program: Program } | { kind: 'saved'; state: object } | null;

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
  /** "Show me" and lesson start: each new nonce replaces the workspace with the program. */
  loadRequest: { program: Program; nonce: number } | null;
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
 * no longer exists) leaves an empty workspace and a console warning instead of an error.
 */
export function loadWorkspace(ws: Blockly.Workspace, initial: BlocksPaneInitial): void {
  if (initial === null) {
    ws.clear();
  } else if (initial.kind === 'program') {
    Blockly.serialization.workspaces.load(programToWorkspaceState(initial.program), ws);
  } else {
    try {
      Blockly.serialization.workspaces.load(initial.state, ws);
    } catch (error) {
      console.warn('Saved blocks could not be loaded; starting with an empty workspace.', error);
      recoverFromFailedLoad(ws);
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

/** The Blockly workspace. Reports every (non-UI) change as a Program plus warnings and state. */
export function BlocksPane(props: BlocksPaneProps) {
  const { unlocked, loadRequest } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  // The latest props, for the workspace's long-lived listeners (and its creation).
  const propsRef = useRef(props);
  const toolboxKeyRef = useRef<string | null>(null);
  const appliedNonceRef = useRef<number | null>(null);

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
    let flushQueued = false;
    // Blockly fires events in batches (a drop or a load is many events); report once per batch.
    const flush = () => {
      flushQueued = false;
      if (disposed) return;
      const { program, warnings } = workspaceToProgram(ws);
      warned = applyWarnings(ws, warnings, warned);
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
    const ws = wsRef.current;
    if (!ws || !loadRequest || loadRequest.nonce === appliedNonceRef.current) return;
    appliedNonceRef.current = loadRequest.nonce;
    loadWorkspace(ws, { kind: 'program', program: loadRequest.program });
  }, [loadRequest]);

  return <div ref={hostRef} className="ogl-blockspane" style={{ width: '100%', height: '100%' }} />;
}
