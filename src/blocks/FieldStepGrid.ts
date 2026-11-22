import * as Blockly from 'blockly';

export const STEP_COUNT = 16;
const STEPS_PER_BEAT = 4;
export const EMPTY_STEPS = '.'.repeat(STEP_COUNT);
const STEPS_PATTERN = new RegExp(`^[x.]{${String(STEP_COUNT)}}$`);

// On-block geometry, in workspace units.
const CELL = 9;
const CELL_GAP = 2;
const BEAT_GAP = 5;
const PAD = 3;
const WIDTH =
  PAD * 2 +
  STEP_COUNT * CELL +
  (STEP_COUNT - 1) * CELL_GAP +
  (STEP_COUNT / STEPS_PER_BEAT - 1) * (BEAT_GAP - CELL_GAP);
const HEIGHT = PAD * 2 + CELL;

export const STEP_GRID_CSS = `
.ogl-step-cell { fill: #ffffff; }
.ogl-step-cell.ogl-step-off { fill-opacity: 0.3; }
.ogl-step-editor { display: flex; gap: 8px; padding: 6px; }
.ogl-step-beat { display: flex; gap: 3px; }
.ogl-step-button {
  width: 26px; height: 26px; padding: 0; cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.85); border-radius: 5px;
  background: rgba(255, 255, 255, 0.15);
}
.ogl-step-button[aria-pressed="true"] { background: #ffffff; }
.ogl-step-button:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
`;

export function isStepString(value: unknown): value is string {
  return typeof value === 'string' && STEPS_PATTERN.test(value);
}

/** Flips step `index` between hit (`x`) and rest (`.`). */
export function toggleStep(steps: string, index: number): string {
  const flipped = steps[index] === 'x' ? '.' : 'x';
  return steps.slice(0, index) + flipped + steps.slice(index + 1);
}

/**
 * The drop-down editor: 16 toggle buttons in four beats. After each toggle it re-reads the
 * value through `getValue`, so a rejected change leaves the buttons showing the real state.
 */
export function createStepEditor(
  doc: Document,
  getValue: () => string,
  setValue: (steps: string) => void,
): HTMLDivElement {
  const editor = doc.createElement('div');
  editor.className = 'ogl-step-editor';
  const buttons: HTMLButtonElement[] = [];
  const refresh = () => {
    const steps = getValue();
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(steps[i] === 'x'));
    });
  };
  for (let beat = 0; beat < STEP_COUNT / STEPS_PER_BEAT; beat += 1) {
    const group = doc.createElement('div');
    group.className = 'ogl-step-beat';
    for (let j = 0; j < STEPS_PER_BEAT; j += 1) {
      const index = beat * STEPS_PER_BEAT + j;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'ogl-step-button';
      button.setAttribute('aria-label', `Step ${String(index + 1)}`);
      button.addEventListener('click', () => {
        setValue(toggleStep(getValue(), index));
        refresh();
      });
      buttons.push(button);
      group.appendChild(button);
    }
    editor.appendChild(group);
  }
  refresh();
  return editor;
}

function cellX(index: number): number {
  const beat = Math.floor(index / STEPS_PER_BEAT);
  return PAD + index * (CELL + CELL_GAP) + beat * (BEAT_GAP - CELL_GAP);
}

export interface FieldStepGridConfig extends Blockly.FieldConfig {
  value?: string;
}

/** A 16-step drum grid. Its value is a 16-character string of `x` (hit) and `.` (rest). */
export class FieldStepGrid extends Blockly.Field<string> {
  override SERIALIZABLE = true;

  private cells: SVGRectElement[] = [];

  constructor(
    value: string | typeof Blockly.Field.SKIP_SETUP = EMPTY_STEPS,
    validator?: Blockly.FieldValidator<string> | null,
    config?: Blockly.FieldConfig,
  ) {
    super(value, validator, config);
  }

  static fromJson(options: FieldStepGridConfig): FieldStepGrid {
    return new FieldStepGrid(options.value ?? EMPTY_STEPS, undefined, options);
  }

  protected override doClassValidation_(newValue?: unknown): string | null {
    return isStepString(newValue) ? newValue : null;
  }

  protected override initView(): void {
    const group = this.fieldGroup_;
    if (group === null) return;
    this.cells = Array.from({ length: STEP_COUNT }, (_, i) =>
      Blockly.utils.dom.createSvgElement(
        Blockly.utils.Svg.RECT,
        { class: 'ogl-step-cell', x: cellX(i), y: PAD, width: CELL, height: CELL, rx: 2, ry: 2 },
        group,
      ),
    );
  }

  protected override render_(): void {
    const steps = this.getValue() ?? EMPTY_STEPS;
    this.cells.forEach((cell, i) => {
      cell.classList.toggle('ogl-step-off', steps[i] !== 'x');
    });
    this.size_ = new Blockly.utils.Size(WIDTH, HEIGHT);
  }

  protected override getText_(): string {
    return this.getValue() ?? EMPTY_STEPS;
  }

  protected override showEditor_(): void {
    Blockly.DropDownDiv.clearContent();
    const editor = createStepEditor(
      document,
      () => this.getValue() ?? EMPTY_STEPS,
      (steps) => {
        this.setValue(steps);
      },
    );
    Blockly.DropDownDiv.getContentDiv().appendChild(editor);
    const block = this.getSourceBlock();
    if (block instanceof Blockly.BlockSvg) {
      Blockly.DropDownDiv.setColour(block.getColour(), block.style.colourTertiary);
    }
    Blockly.DropDownDiv.showPositionedByField<string>(this);
    editor.querySelector('button')?.focus();
  }
}
