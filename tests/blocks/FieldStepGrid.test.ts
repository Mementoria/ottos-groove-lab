import { describe, expect, it, vi } from 'vitest';
import { FieldStepGrid, createStepEditor, toggleStep } from '../../src/blocks/FieldStepGrid';

describe('FieldStepGrid', () => {
  it('round-trips a valid 16-step pattern', () => {
    const field = new FieldStepGrid('x...x...x...x...');
    expect(field.getValue()).toBe('x...x...x...x...');
  });

  it('defaults to an empty pattern', () => {
    expect(new FieldStepGrid().getValue()).toBe('................');
  });

  it.each(['bad', 'x...x...x...x..', 'x...x...x...x....', 'x...x...x...x..o', 42, null])(
    'rejects %j and keeps the previous value',
    (bad) => {
      const field = new FieldStepGrid('x...x...x...x...');
      field.setValue(bad);
      expect(field.getValue()).toBe('x...x...x...x...');
    },
  );

  it('builds from JSON options, as the field registry does', () => {
    const field = FieldStepGrid.fromJson({ value: 'xx..............' });
    expect(field.getValue()).toBe('xx..............');
  });

  it('is serializable so the steps are saved with the workspace', () => {
    const field = new FieldStepGrid();
    field.name = 'STEPS'; // Blockly only serializes named fields; a block sets this on append.
    expect(field.isSerializable()).toBe(true);
    expect(field.saveState()).toBe('................');
  });
});

describe('toggleStep', () => {
  it('flips one step on and off', () => {
    expect(toggleStep('................', 3)).toBe('...x............');
    expect(toggleStep('...x............', 3)).toBe('................');
  });
});

describe('createStepEditor', () => {
  it('renders 16 toggle buttons in four groups of four', () => {
    const editor = createStepEditor(document, () => 'x...............', vi.fn());
    expect(editor.querySelectorAll('button')).toHaveLength(16);
    expect(editor.children).toHaveLength(4);
    const first = editor.querySelector('button');
    expect(first).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles a step on click and refreshes from the field value', () => {
    let value = '................';
    const setValue = vi.fn((next: string) => {
      value = next;
    });
    const editor = createStepEditor(document, () => value, setValue);
    const buttons = editor.querySelectorAll('button');
    buttons[2]?.click();
    expect(setValue).toHaveBeenCalledWith('..x.............');
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
  });
});
