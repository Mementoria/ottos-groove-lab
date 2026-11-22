import type { BlockType } from '../blocks/blockTypes';
import type { Check } from '../checkers/checks';
import type { CodePaneMode } from '../codepane/CodePane';
import type { Highlight } from '../otto/highlightBus';
import type { Program } from '../program/types';

/** Rung 1 is a nudge (say only); rung 2 adds a highlight. */
export interface Hint {
  say: string;
  highlight?: Highlight;
}

export interface Step {
  id: string;
  /** Checklist text. */
  label: string;
  type: 'guided' | 'puzzle' | 'open';
  /** Otto's intro lines. */
  say: string[];
  /** Loaded into the workspace when the step begins; omit to keep the current workspace. */
  start?: Program;
  check: Check;
  /** Rungs 1 and 2; rung 3 is always "Show me", which loads `solution`. */
  hints: [Hint, Hint];
  solution: Program;
  /** "Hear the goal": played instead of the workspace while held or toggled. */
  target?: Program;
  /** Otto's line on completion. */
  success: string;
}

export interface Lesson {
  id: string;
  module: 0 | 1 | 2 | 'acid';
  title: string;
  /** The cumulative toolbox is the union of this and all earlier lessons. */
  unlocks: BlockType[];
  codePane: CodePaneMode;
  spectrum: boolean;
  steps: Step[];
}
