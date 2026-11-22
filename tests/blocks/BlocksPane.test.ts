import * as Blockly from 'blockly';
import { loadWorkspace } from '../../src/blocks/BlocksPane';
import { registerBlocks } from '../../src/blocks/blockTypes';
import { programToWorkspaceState, workspaceToProgram } from '../../src/blocks/convert';
import { layer, mod, program, sound } from '../../src/program/build';

// Blockly.inject needs SVG layout APIs jsdom lacks, so the component itself is checked in a
// browser; this covers how it fills a (headless) workspace.

let ws: Blockly.Workspace;

beforeAll(() => {
  registerBlocks();
});

beforeEach(() => {
  ws = new Blockly.Workspace();
});

afterEach(() => {
  ws.dispose();
  vi.restoreAllMocks();
});

const sample = () => program(110, layer(sound('bd sd'), mod('gain', 0.8)));

describe('loadWorkspace', () => {
  it('loads a program', () => {
    const p = sample();
    loadWorkspace(ws, { kind: 'program', program: p });
    expect(workspaceToProgram(ws).program).toEqual(p);
  });

  it('loads saved workspace state', () => {
    const p = sample();
    const source = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(programToWorkspaceState(p), source);
    const saved = Blockly.serialization.workspaces.save(source);
    source.dispose();

    loadWorkspace(ws, { kind: 'saved', state: saved });

    expect(workspaceToProgram(ws).program).toEqual(p);
  });

  it('leaves the workspace empty for null', () => {
    loadWorkspace(ws, null);
    expect(ws.getAllBlocks(false)).toHaveLength(0);
  });

  it('falls back to an empty workspace when saved state references an unknown block', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = programToWorkspaceState(sample());
    const corrupt = {
      blocks: {
        languageVersion: 0,
        blocks: [...state.blocks.blocks, { type: 'ogl_removed_block', id: 'gone', x: 0, y: 0 }],
      },
    };

    expect(() => {
      loadWorkspace(ws, { kind: 'saved', state: corrupt });
    }).not.toThrow();

    expect(ws.getAllBlocks(false)).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(Blockly.Events.getGroup()).toBe('');
    expect(Blockly.Events.getRecordUndo()).toBe(true);
    loadWorkspace(ws, { kind: 'program', program: sample() });
    expect(workspaceToProgram(ws).program.layers).toHaveLength(1);
  });

  it('falls back to an empty workspace when saved state is not workspace JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    loadWorkspace(ws, { kind: 'saved', state: { blocks: 'nope' } });
    expect(ws.getAllBlocks(false)).toHaveLength(0);
  });
});
