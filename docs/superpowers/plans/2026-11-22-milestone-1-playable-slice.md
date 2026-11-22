# Otto's Groove Lab: Milestone 1 (Playable Slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable browser app where Otto teaches Modules 0–2 and guides the Acid song, using Blockly blocks that generate real Strudel code shown in a collapsed or read-only code pane.

**Architecture:** A small **program model** sits between Blockly and Strudel. The Blockly workspace is read into the model, and the model generates Strudel code: `$:` layers for playback, plus a `stack(...)` expression for checks. Checkers evaluate that expression headlessly with `@strudel/transpiler` and query the pattern's events, so lesson content can be validated in Node tests. The React shell wires together the stage (checklist, Otto, waveform, transport), the blocks pane, the code pane, and a pure lesson-runner reducer.

**Tech Stack:** Vite 6, React 18, TypeScript (strict), Blockly 13 (Zelos renderer), @strudel/web 1.3.0, @strudel/core / mini / tonal / transpiler 1.2.6, @strudel/soundfonts 1.3.0, @strudel/codemirror 1.3.0 (highlight extension only) on CodeMirror 6, Vitest + jsdom + @testing-library/react, ESLint (typescript-eslint).

**Spec:** `docs/superpowers/specs/2026-11-22-strudel-blocks-design.md` (milestone 1 = spec §8 item 1)

## Global Constraints

- License **AGPL-3.0-or-later** (a `LICENSE` file, plus `"license"` in package.json).
- TypeScript `strict: true`. **No `any`** in production or test code; ESLint `@typescript-eslint/no-explicit-any: "error"`. Tests are held to the same lint bar.
- Strudel packages ship no types. All Strudel imports go through hand-written declarations in `src/types/strudel.d.ts`, typed with `unknown` and narrow interfaces, never `any`.
- Generated code must be real Strudel that plays the same when pasted into strudel.cc.
- Program shape: `setcpm(BPM/4)` on its own line, then one `$:` line per layer (`_$:` when muted), with modifiers on following lines indented 2 spaces.
- Desktop-first. No backend. Static build deployable to GitHub Pages under a sub-path.
- Public name **"Otto's Groove Lab"**, and never "Scratch" in user-facing text. Repo/package name `ottos-groove-lab`.
- Otto is "he"; his tone is friendly and addresses an adult. Ear first: hear, then see the wave, then the block, then the code.
- Proactive hint thresholds: offer the next rung after **45 s** without completing the step (since step start or the last offer), or after **5** failed automatic checks.
- Code pane modes in M1: **`collapsed`** (Modules 0–1, with a "peek at the code" toggle) and **`readonly`** (Module 2 and the Acid song).
- Spectrum view becomes available from Module 2; the oscilloscope is the default.

## Review Focus

1. **Play pressed before audio is ready** (first visit, before samples load, or a suspended AudioContext after the tab was backgrounded). Expected: play initialises or resumes audio and then plays, and never fails silently. The test is in Task 5.
2. **Samples or soundfonts fail to load** (offline, a CDN error). Expected: the engine reports the error state, Otto says the sounds couldn't load and offers a retry, and the UI never hangs. The test is in Task 5.
3. **Incomplete workspaces:** orphan modifier blocks, a layer hat with nothing under it, a layer whose first block isn't a source, an empty mini string. Expected: those layers are skipped, with a warning on the block; the code shows only valid layers; an all-empty program plays silence without throwing. The tests are in Task 6 and Task 2.
4. **Rapid edits while playing:** many program changes within the debounce window. Expected: the last edit wins, and a slow earlier evaluation never overwrites a newer pattern or check result. The test is in Task 11.
5. **Corrupt or old saved data** in localStorage (bad JSON, unknown version, a workspace that references a removed block type). Expected: fall back to fresh state for that piece and keep going, with no crash or white screen. The test is in Task 11.

---

## File Structure

```
index.html
vite.config.ts                 base path from env (GitHub Pages)
src/main.tsx                   React root
src/App.tsx                    shell: start screen → course map → lesson view
src/app/useLessonSession.ts    wires program ⇄ engine ⇄ checks ⇄ runner
src/app/storage.ts             versioned localStorage
src/app/share.ts               copy code / strudel.cc URL
src/program/types.ts           Program model
src/program/build.ts           tiny builder helpers for authoring content
src/program/codegen.ts         Program → Strudel code (+ spans) and check expression
src/audio/compile.ts           headless check-expression → Pattern
src/audio/engine.ts            playback engine around @strudel/web
src/checkers/checks.ts         Check union + runCheck
src/blocks/blockTypes.ts       block definitions (JSON) + type constants
src/blocks/FieldStepGrid.ts    custom 16-step grid field
src/blocks/toolbox.ts          toolbox from unlocked block types
src/blocks/theme.ts            Zelos theme
src/blocks/convert.ts          Workspace ⇄ Program
src/blocks/BlocksPane.tsx      Blockly React wrapper
src/codepane/CodePane.tsx      CodeMirror view, modes, glow, active-note flash
src/stage/Stage.tsx            checklist | Otto | scope + transport + hint
src/stage/Checklist.tsx
src/stage/Scope.tsx            oscilloscope / spectrum canvas
src/otto/Otto.tsx              SVG octopus
src/otto/motion.ts             tentacle/bob math
src/otto/Bubble.tsx            speech bubble with dialogue queue
src/otto/highlightBus.ts       "glow these blocks/spans" pub-sub
src/lessons/types.ts           Lesson/Step/Hint schema
src/lessons/runner.ts          pure reducer: steps, hints, proactive offers
src/lessons/content/module0.ts
src/lessons/content/module1.ts
src/lessons/content/module2.ts
src/lessons/content/acid.ts
src/lessons/content/index.ts   course order
src/types/strudel.d.ts
tests/…                        mirrors src/
.github/workflows/pages.yml
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `LICENSE`, `README.md`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vitest.config.ts`, `tests/setup.ts`
- Test: `tests/App.test.tsx`

**Interfaces:**
- Produces: the npm scripts `dev`, `build`, `test`, `lint`, `typecheck`. `vite.config.ts` reads `base` from `process.env.BASE_PATH ?? '/'`.

- [ ] **Step 1:** `git init`, then create `.gitignore` with `node_modules`, `dist`, `.superpowers/`, `*.local`.
- [ ] **Step 2:** Scaffold Vite React-TS by hand. Install: `blockly@13`, `@strudel/web@1.3.0`, `@strudel/core@1.2.6`, `@strudel/mini@1.2.6`, `@strudel/tonal@1.2.6`, `@strudel/transpiler@1.2.6`, `@strudel/soundfonts@1.3.0`, `@strudel/codemirror@1.3.0`, `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-javascript`, `react@18`, `react-dom@18`. Dev: `typescript`, `vite@6`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`.
- [ ] **Step 3:** `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`. ESLint: `tseslint.configs.strictTypeChecked` plus the rule `@typescript-eslint/no-explicit-any: "error"`, applied to `src` and `tests`.
- [ ] **Step 4:** Write `LICENSE` (the full AGPL-3.0 text) and a `README.md` (name, one-paragraph pitch, `npm run dev`, a note on the AGPL and Strudel credit).
- [ ] **Step 5: Write the failing test.** `tests/App.test.tsx` → `it('renders the app title')`: render `<App />`, then expect `screen.getByText("Otto's Groove Lab")` to be in the document.
- [ ] **Step 6:** Run `npm test`. Expected: FAIL (App has no title).
- [ ] **Step 7:** Make `App` render an `<h1>Otto's Groove Lab</h1>` placeholder.
- [ ] **Step 8:** Run `npm test && npm run lint && npm run typecheck && npm run build`. Expected: all pass.
- [ ] **Step 9: Commit** (include `docs/`): `git add -A && git commit -m "chore: scaffold Otto's Groove Lab"`

---

### Task 2: Program model and code generation

**Files:**
- Create: `src/program/types.ts`, `src/program/build.ts`, `src/program/codegen.ts`
- Test: `tests/program/codegen.test.ts`

**Interfaces:**
- Produces:
```ts
// types.ts
export type Oscillator = 'sawtooth' | 'square' | 'triangle' | 'sine';
export type SignalName = 'sine' | 'saw' | 'square' | 'tri' | 'perlin';
export type NumArg =
  | { kind: 'number'; value: number }
  | { kind: 'signal'; signal: SignalName; min: number; max: number; slow: number };
export type NumericModName =
  | 'fast' | 'slow' | 'gain' | 'pan' | 'lpf' | 'lpq' | 'hpf'
  | 'lpenv' | 'lpa' | 'lpd' | 'lps'
  | 'attack' | 'decay' | 'sustain' | 'release'
  | 'delay' | 'room' | 'distort';
export type Modifier =
  | { id: string; name: NumericModName; arg: NumArg }
  | { id: string; name: 's'; value: Oscillator }
  | { id: string; name: 'bank'; value: 'RolandTR909' | 'RolandTR808' }
  | { id: string; name: 'ftype'; value: '12db' | '24db' | 'ladder' };
export type Source =
  | { id: string; kind: 'sound'; mini: string }   // s("…")
  | { id: string; kind: 'notes'; mini: string }   // note("…")
  | { id: string; kind: 'grid'; sound: string; steps: boolean[] }; // 16 steps → s("…")
export interface Layer { id: string; muted: boolean; source: Source; mods: Modifier[] }
export interface Program { bpm: number | null; layers: Layer[] }
// codegen.ts
export interface Generated { code: string; spans: Record<string, [from: number, to: number]> }
export function gridToMini(sound: string, steps: boolean[]): string;
export function toStrudelCode(p: Program): Generated;
export function toCheckExpression(p: Program): string;
// build.ts: authoring helpers. ids are auto-generated as `${kind}-${counter}`.
export function program(bpm: number | null, ...layers: Layer[]): Program;
export function layer(source: Source, ...mods: Modifier[]): Layer;
export function muted(l: Layer): Layer;
export function sound(mini: string): Source;
export function notes(mini: string): Source;
export function grid(sound: string, hits: number[]): Source;   // hits = step indexes 0..15
export function mod(name: NumericModName, arg: number | NumArg): Modifier;
export function osc(o: Oscillator): Modifier;
export function bank(b: 'RolandTR909' | 'RolandTR808'): Modifier;
export function ftype(f: '12db' | '24db' | 'ladder'): Modifier;
export function signal(signal: SignalName, min: number, max: number, slow: number): NumArg;
```

- [ ] **Step 1: Write the failing tests** in `tests/program/codegen.test.ts`:
  - `gridToMini('bd', steps on 0,4,8,12)` === `'[bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~]'`. A beat with no hits renders as `~`: with only step 0 on, `'[bd ~ ~ ~] ~ ~ ~'`.
  - `toStrudelCode(program(130, layer(grid('bd',[0,4,8,12]), bank('RolandTR909')), layer(notes('c2 c2 eb2 c3'), osc('sawtooth'), mod('lpf', signal('sine',200,2000,4)))))`. The `.code` is exactly:
    ```
    setcpm(130/4)

    $: s("[bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~]")
      .bank("RolandTR909")

    $: note("c2 c2 eb2 c3")
      .s("sawtooth")
      .lpf(sine.range(200, 2000).slow(4))
    ```
    The test ends with a trailing newline.
  - A muted layer emits `_$: `. `bpm: null` emits no `setcpm` line and no leading blank line.
  - `spans[mod.id]` slices the code to exactly `.lpf(sine.range(200, 2000).slow(4))`, and `spans[source.id]` slices to `note("c2 c2 eb2 c3")`.
  - Strings are emitted with `JSON.stringify`, so a mini containing `"` is escaped.
  - `toCheckExpression` of the same program === `stack(s("[bd …]").bank("RolandTR909"), note("c2 c2 eb2 c3").s("sawtooth").lpf(sine.range(200, 2000).slow(4)))` (single line, muted layers excluded).
  - **Review Focus 3:** `toCheckExpression(program(null))` === `'silence'`. A layer whose source mini is whitespace-only is omitted from both outputs.
  - Numbers: `mod('gain', 0.8)` → `.gain(0.8)`; integers have no decimal point.
- [ ] **Step 2:** Run `npx vitest run tests/program`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `types.ts`, `build.ts`, and `codegen.ts` with the signatures above. Codegen builds the string with a running offset so the spans are exact.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: program model and Strudel code generation`

---

### Task 3: Headless pattern compile for checks

**Files:**
- Create: `src/types/strudel.d.ts`, `src/audio/compile.ts`
- Test: `tests/audio/compile.test.ts`

**Interfaces:**
- Produces:
```ts
// strudel.d.ts (excerpt; extend as later tasks need, never `any`)
export interface Fraction { valueOf(): number }
export interface Hap { whole: { begin: Fraction; end: Fraction } | undefined; value: Record<string, unknown>; hasOnset(): boolean }
export interface Pattern { queryArc(begin: number, end: number): Hap[] }
// compile.ts
export async function compileForCheck(expression: string): Promise<Pattern>;
export interface Onset { cycle: number; step16: number | null; value: Record<string, unknown> }
export function onsets(p: Pattern, cycles: number): Onset[];  // haps with onset in [0, cycles)
```
- Approach: once per process, `await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'))`; then `(await evaluate(expression)).pattern` using `evaluate` from `@strudel/transpiler`. `step16` = `(begin mod 1) * 16` if that's an integer, else `null`.

- [ ] **Step 1: Write the failing tests:**
  - `onsets(await compileForCheck('s("bd*4")'), 1)` has length 4, with `step16` values `[0,4,8,12]` and `value.s === 'bd'`.
  - `onsets(await compileForCheck('note("c2 eb2").s("sawtooth").lpf(sine.range(200, 2000).slow(4))'), 4)`: 8 onsets, every `value.lpf` is a number between 200 and 2000, and the set of `lpf` values has more than 1 member.
  - `compileForCheck('silence')` yields 0 onsets.
  - `compileForCheck('s("bd" ')` (a syntax error) rejects.
- [ ] **Step 2:** Run `npx vitest run tests/audio/compile.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. If `@strudel/tonal` fails to import under Node, keep it out of the check scope and note that in a code comment. It isn't needed until Module 4.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: headless Strudel compile for lesson checks`

---

### Task 4: Checkers

**Files:**
- Create: `src/checkers/checks.ts`
- Test: `tests/checkers/checks.test.ts`

**Interfaces:**
- Consumes: `Program`, `toCheckExpression` (Task 2); `compileForCheck`, `onsets`, `Onset` (Task 3).
- Produces:
```ts
export type Where = { s?: string; bank?: string };
export type Check =
  | { kind: 'manual' }                                       // passes only via "Next"/"sounds right"
  | { kind: 'playing' }                                      // ctx.playing
  | { kind: 'all'; checks: Check[] }
  | { kind: 'any'; checks: Check[] }
  | { kind: 'layers'; min: number }
  | { kind: 'tempo'; bpm: number; tolerance: number }
  | { kind: 'onsetsPerCycle'; where: Where; count: number }
  | { kind: 'onsetsAt'; where: Where; steps: number[] }     // exactly these 16th-steps in cycle 0
  | { kind: 'hasSound'; s: string }
  | { kind: 'distinctNotes'; min: number }
  | { kind: 'control'; control: string; min?: number; max?: number; equals?: string | number }
  | { kind: 'controlVaries'; control: string; cycles: number; minSpread: number };
export interface CheckContext { program: Program; onsets: Onset[]; playing: boolean }  // onsets over 4 cycles
export interface CheckResult { pass: boolean; reason: string }
export function runCheck(check: Check, ctx: CheckContext): CheckResult;
export async function buildContext(program: Program, playing: boolean): Promise<CheckContext>;
```
- Semantics: `onsetsPerCycle` counts matching onsets in cycle 0. `control` passes when at least one onset has the control and **every** onset that has it satisfies min, max and equals. `controlVaries` passes when (max − min) of that control across all onsets in the window ≥ `minSpread`. `manual` always returns `pass: false` (the runner treats it specially). `reason` is a short developer-facing string used in tests and debugging, not shown to learners.

- [ ] **Step 1: Write the failing tests.** For each kind, one pass case and one fail case, built with `build.ts` helpers and `buildContext`. Include:
  - `onsetsAt` on `grid('bd',[0,4,8,12])` with steps `[0,4,8,12]` passes, and with `[0,8]` fails.
  - `controlVaries` on lpf with a sine signal from 200 to 2000 over 4 cycles, `minSpread: 500`, passes; a constant `lpf 800` fails.
  - `tempo` reads `program.bpm`; `bpm: null` fails.
  - `all` and `any` combine as expected.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: lesson checkers over pattern events`

---

### Task 5: Audio engine

**Files:**
- Create: `src/audio/engine.ts`
- Modify: `src/types/strudel.d.ts` (add the `@strudel/web`, `@strudel/soundfonts` and `superdough` surface used here)
- Test: `tests/audio/engine.test.ts`

**Interfaces:**
- Produces:
```ts
export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';
export interface EvalInfo { pattern: Pattern; miniLocations: [number, number][] }
export interface AudioEngine {
  status(): EngineStatus;
  onStatus(cb: (s: EngineStatus, error?: Error) => void): () => void;
  start(): Promise<void>;            // call from a user gesture; idempotent; resumes a suspended context
  play(code: string): Promise<EvalInfo | null>;   // starts audio if needed, then evaluates and plays
  update(code: string): Promise<EvalInfo | null>; // re-evaluates; plays only if already playing
  stop(): void;
  isPlaying(): boolean;
  cyclePosition(): number;           // scheduler.now(), 0 when not playing
  analyser(): AnalyserNode | null;   // connected to the superdough destination gain
}
export interface StrudelBackend {    // a seam for tests; the real one wraps @strudel/web
  init(): Promise<void>;
  evaluate(code: string, autoplay: boolean): Promise<EvalInfo | null>;
  stop(): void;
  now(): number;
  audioContext(): AudioContext;
  outputNode(): AudioNode;           // getSuperdoughAudioController().output.destinationGain
}
export function createEngine(backend?: StrudelBackend): AudioEngine;
export function createStrudelBackend(): StrudelBackend;
```
- The real backend: `initStrudel({ prebake: async () => { await Promise.all([samples('github:tidalcycles/dirt-samples'), samples('github:ritchse/tidal-drum-machines/main/machines'), registerSoundfonts()]) } })`. Get `miniLocations` via the repl's `afterEval` meta (pass `afterEval` in the `initStrudel` options). Create one `AnalyserNode` (`fftSize` 2048) connected to `outputNode()`. Error handling: a rejected `init` sets status `error` and keeps the error. `start()` after an error retries.

- [ ] **Step 1: Write the failing tests** with a fake `StrudelBackend`:
  - **Review Focus 1:** `play(code)` while `idle` calls `init` first, then `evaluate(code, true)`, in that order, and status ends `ready`.
  - `play` while status is `loading` awaits the same init (`init` called once).
  - If the audio context state is `'suspended'`, `play` calls `audioContext().resume()` before evaluating.
  - **Review Focus 2:** when `init` rejects, status is `error`, `onStatus` receives the error, `play` resolves `null` without evaluating, and a later `start()` retries `init`.
  - `update(code)` while stopped calls `evaluate(code, false)`; while playing, `evaluate(code, true)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `createEngine` and `createStrudelBackend`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Manual verification.** Add a temporary dev-only button in `App` that plays `$: s("bd*4").bank("RolandTR909")\n$: note("c2 eb2").s("sawtooth")`. Run `npm run dev` and confirm in the browser pane that you hear a 909 kick and a saw bass. If the `tidal-drum-machines` source fails, switch it to `samples('https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json')` and re-check. Remove the button.
- [ ] **Step 6: Commit:** `feat: audio engine around @strudel/web`

---

### Task 6: Blocks, step-grid field, and the workspace ⇄ Program conversion

**Files:**
- Create: `src/blocks/blockTypes.ts`, `src/blocks/FieldStepGrid.ts`, `src/blocks/toolbox.ts`, `src/blocks/theme.ts`, `src/blocks/convert.ts`
- Test: `tests/blocks/convert.test.ts`, `tests/blocks/FieldStepGrid.test.ts`

**Interfaces:**
- Consumes: `Program`, `Layer`, `Source`, `Modifier`, `NumArg` (Task 2).
- Produces:
```ts
// blockTypes.ts
export const BT = {
  layer: 'ogl_layer', tempo: 'ogl_tempo',
  sound: 'ogl_sound', notes: 'ogl_notes', grid: 'ogl_grid',
  osc: 'ogl_osc', bank: 'ogl_bank', ftype: 'ogl_ftype', signal: 'ogl_signal',
  // one numeric modifier block per NumericModName: `ogl_mod_${name}`
} as const;
export type BlockType = string;            // a BT value or `ogl_mod_${NumericModName}`
export function modBlockType(name: NumericModName): BlockType;
export function registerBlocks(): void;    // idempotent; registers blocks + FieldStepGrid
// toolbox.ts
export type Category = 'Layers' | 'Sounds' | 'Notes' | 'Filter' | 'Envelope' | 'Movement' | 'Effects' | 'Time';
export function buildToolbox(unlocked: BlockType[]): Blockly.utils.toolbox.ToolboxDefinition;  // categories with no unlocked blocks are omitted
// convert.ts
export interface ConvertWarning { blockId: string; message: string }
export function workspaceToProgram(ws: Blockly.Workspace): { program: Program; warnings: ConvertWarning[] };
export function programToWorkspaceState(p: Program): object;   // for Blockly.serialization.workspaces.load
```
- **Block shapes (Scratch-style vertical stacks):**
  - `ogl_layer`: a hat block reading "🐙 arm" with a `field_checkbox` `MUTED` ("mute") and `nextStatement`. The chain below the hat is the source block, then the modifier blocks.
  - Sources (`ogl_sound` "play sound [mini]", `ogl_notes` "play notes [mini]", `ogl_grid` "drum [sound] [grid]"): previous and next connections, with field `MINI` (`field_input`) or `SOUND` (`field_input`) plus `STEPS` (FieldStepGrid).
  - Numeric modifiers: a value input `VALUE` with check `['Number','Signal']` and a `math_number` shadow. The label is a friendly name plus the Strudel name in a subtle field, for example "filter cutoff · lpf".
  - `ogl_osc`, `ogl_bank`, `ogl_ftype`: a `field_dropdown` `VALUE`.
  - `ogl_signal`: output `Signal`; dropdown `SIGNAL`, number fields `MIN`, `MAX`, `SLOW`. It reads "[sine] wave from [200] to [2000] over [4] cycles".
  - `ogl_tempo`: a standalone top block "tempo [130] BPM" with field `BPM`, and no connections.
- **FieldStepGrid:** extends `Blockly.Field<string>`. The value is a 16-character string of `x`/`.`. The on-block view is 16 small squares, grouped in fours. Clicking opens a `Blockly.DropDownDiv` with 16 toggle buttons.
- **Conversion rules:** every top `ogl_layer`, in workspace top-to-bottom order, becomes a `Layer`, with `id = blockId`. If the first block under a hat isn't a source → warning "Start this arm with a sound or notes block", and the layer is skipped. Blocks not under a hat → warning "Attach me under an arm", and they're ignored; call `Blockly.Events.disableOrphans` in the UI only. The first `ogl_tempo` sets `bpm`, and additional ones produce a warning.

- [ ] **Step 1: Write the failing tests** (headless `new Blockly.Workspace()` after `registerBlocks()`):
  - A round trip: for the Task 2 sample program, `workspaceToProgram(load(programToWorkspaceState(p)))` deep-equals `p`, ignoring ids, with a structural compare helper in the test.
  - **Review Focus 3:** a hat with nothing under it is skipped, with no warning. A hat whose first block is `ogl_mod_lpf` is skipped with a warning naming that block id. An orphan `ogl_osc` produces the "Attach me under an arm" warning. A workspace with only orphans → `program.layers` is empty.
  - `buildToolbox(['ogl_layer','ogl_sound'])` contains exactly the `Layers` and `Sounds` categories.
  - FieldStepGrid: `new FieldStepGrid('x...x...x...x...').getValue()` round-trips; `setValue('bad')` is rejected (the validator returns `null`), so the value is unchanged.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `grid` sources map to the field string as `steps[i] = ch === 'x'`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Strudel blocks, step grid, workspace ⇄ program`

---

### Task 7: BlocksPane and CodePane components

**Files:**
- Create: `src/blocks/BlocksPane.tsx`, `src/codepane/CodePane.tsx`, `src/otto/highlightBus.ts`
- Test: `tests/otto/highlightBus.test.ts`, `tests/codepane/CodePane.test.tsx`

**Interfaces:**
- Consumes: `buildToolbox`, `workspaceToProgram`, `programToWorkspaceState`, `registerBlocks` (Task 6); `Generated` (Task 2); `AudioEngine.cyclePosition`, `EvalInfo` (Task 5).
- Produces:
```ts
// highlightBus.ts
export interface Highlight { blockTypes?: BlockType[]; nodeIds?: string[]; ttlMs?: number }  // default ttl 2500
export const highlightBus: { emit(h: Highlight): void; subscribe(cb: (h: Highlight) => void): () => void };
// BlocksPane.tsx
export interface BlocksPaneProps {
  unlocked: BlockType[];
  initial: Program | object | null;      // a Program, or saved Blockly JSON
  onChange(result: { program: Program; warnings: ConvertWarning[]; state: object }): void;
  loadRequest: { program: Program; nonce: number } | null;   // "Show me" and lesson start
}
// CodePane.tsx
export type CodePaneMode = 'collapsed' | 'readonly';
export interface CodePaneProps { generated: Generated; mode: CodePaneMode; evalInfo: EvalInfo | null; cyclePosition: () => number }
```
- BlocksPane: `Blockly.inject(div, { renderer: 'zelos', theme, toolbox, trashcan: true, zoom: { controls: true } })`. Listen to change events, ignoring UI events, and call `onChange`. Put warnings on the blocks with `block.setWarningText`. On highlight: `workspace.highlightBlock(id, true)` for every block whose type is in `blockTypes` or whose id is in `nodeIds`, cleared after the ttl.
- CodePane: CodeMirror `EditorState.readOnly.of(true)`, `javascript()`, and `highlightExtension` from `@strudel/codemirror`. On `evalInfo`, call `updateMiniLocations(view, evalInfo.miniLocations)`. Each rAF frame while playing: `highlightMiniLocations(view, now, pattern.queryArc(now - 0.05, now))`. On highlight: mark the spans `generated.spans[id]` for `nodeIds` with a decoration class `ogl-glow`. `collapsed` renders a "peek at the code" button that expands it in place (local state).

- [ ] **Step 1: Write the failing tests.** For highlightBus: subscribe, emit, unsubscribe. For CodePane: in `collapsed` mode the code text isn't in the document until "peek at the code" is clicked; in `readonly` mode the text `$: s(` is visible.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement both components and the bus.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: blocks pane and code pane`

---

### Task 8: Otto

**Files:**
- Create: `src/otto/Otto.tsx`, `src/otto/motion.ts`, `src/otto/Bubble.tsx`
- Test: `tests/otto/motion.test.ts`, `tests/otto/Bubble.test.tsx`

**Interfaces:**
- Produces:
```ts
// motion.ts
export function rms(samples: Float32Array): number;                    // 0..1
export function tentaclePath(index: number, beatPhase: number, level: number): string;  // SVG path d; index 0..7
export function bobOffset(beatPhase: number, level: number): number;   // px, 0..8
// Otto.tsx
export interface OttoProps { beatPhase: () => number; level: () => number; mood: 'idle' | 'talking' | 'cheer' }
// Bubble.tsx
export interface BubbleProps { lines: string[]; onDone(): void; actions?: { label: string; onClick(): void }[] }
```
- Look: match the approved mockup (a purple head, white eyes, a smile, black headphones, 8 tentacles). Tentacles sway with phase offset `index * π/4`, and the amplitude scales with `0.3 + 0.7*level`. When not playing, there's a slow idle sway: Otto's parent passes `beatPhase` from `performance.now()`. `cheer` is a short jump plus raised tentacles, used on step completion. Use rAF inside `Otto` and update the path `d` attributes via refs, not React state.
- Bubble: shows one line at a time, with a "→" button to advance; after the last line it calls `onDone` and shows `actions`. `**text**` renders as `<code>`, so dialogue can name `lpf`.

- [ ] **Step 1: Write the failing tests:**
  - `rms` of all zeros is 0; for a full-scale square it's ≈1.
  - `tentaclePath` is deterministic, and different for phase 0 vs 0.5 at level 1.
  - `bobOffset(·, 0)` ≤ `bobOffset(·, 1)`.
  - Bubble: shows line 1; clicking → shows line 2; after the last line `onDone` is called once and the actions render. `` `lpf` ``-style markup (`**lpf**`) renders a `code` element.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: Otto the octopus`

---

### Task 9: Stage (checklist, scope, transport)

**Files:**
- Create: `src/stage/Stage.tsx`, `src/stage/Checklist.tsx`, `src/stage/Scope.tsx`
- Test: `tests/stage/Checklist.test.tsx`, `tests/stage/Stage.test.tsx`

**Interfaces:**
- Consumes: `Otto`, `Bubble` (Task 8); `AudioEngine` (Task 5).
- Produces:
```ts
export interface ChecklistProps { title: string; labels: string[]; current: number; completed: number }  // completed = count done
export interface ScopeProps { analyser: () => AnalyserNode | null; mode: 'scope' | 'spectrum' }
export interface StageProps {
  checklist: ChecklistProps;
  otto: OttoProps; bubble: BubbleProps;
  scope: ScopeProps; spectrumAvailable: boolean;
  playing: boolean; onPlay(): void; onStop(): void;
  onHint(): void; hintDisabled: boolean;
  hasTarget: boolean; targetPlaying: boolean; onToggleTarget(): void;
  engineError: string | null; onRetryAudio(): void;
}
```
- Layout per spec §5.1: checklist on the left (about 160 px), Otto and the bubble in the middle, the scope on the right with ▶/■, 💡 and a scope/spectrum toggle (shown only when `spectrumAvailable`). Scope: canvas with `getFloatTimeDomainData` (scope) or `getFloatFrequencyData` (spectrum, log-frequency x axis), drawn in rAF.
- When `engineError` is set, the bubble area shows Otto's message "I can't reach the sound library. Check your connection?" with a Retry action (part of Review Focus 2).

- [ ] **Step 1: Write the failing tests.** Checklist: with 5 labels, `current` 2 and `completed` 2, the first two are marked done (`aria-label` containing "done") and the third is `aria-current="step"`. Stage: the spectrum toggle is absent when `spectrumAvailable` is false; clicking ▶ calls `onPlay`; `engineError` renders the retry button, which calls `onRetryAudio`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: stage with checklist, scope and transport`

---

### Task 10: Lesson schema, runner, and content validation harness

**Files:**
- Create: `src/lessons/types.ts`, `src/lessons/runner.ts`, `src/lessons/content/index.ts`
- Test: `tests/lessons/runner.test.ts`, `tests/lessons/content.test.ts`

**Interfaces:**
- Consumes: `Check`, `runCheck`, `buildContext` (Task 4); `Program` (Task 2); `BlockType` (Task 6); `CodePaneMode`, `Highlight` (Task 7).
- Produces:
```ts
// types.ts
export interface Hint { say: string; highlight?: Highlight }   // rung 1 nudge: say only; rung 2: say + highlight
export interface Step {
  id: string; label: string;                        // label = checklist text
  type: 'guided' | 'puzzle' | 'open';
  say: string[];                                    // Otto's intro lines
  start?: Program;                                  // load into the workspace when the step begins (omit = keep current)
  check: Check;
  hints: [Hint, Hint];                              // rungs 1–2; rung 3 is always "Show me" → loads `solution`
  solution: Program;
  target?: Program;                                 // "🎧 hear the goal": plays this instead of the workspace while held/toggled
  success: string;                                  // Otto's line on completion
}
export interface Lesson {
  id: string; module: 0 | 1 | 2 | 'acid'; title: string;
  unlocks: BlockType[];                             // cumulative toolbox = union of this and all earlier lessons
  codePane: CodePaneMode; spectrum: boolean;
  steps: Step[];
}
// runner.ts
export interface RunnerState {
  stepIndex: number; completed: boolean;
  hintLevel: 0 | 1 | 2 | 3;                          // highest rung shown
  failedChecks: number; idleSince: number;          // ms timestamp of step start or last offer
  offer: boolean;                                   // Otto is offering the next rung
}
export type RunnerEvent =
  | { type: 'checked'; pass: boolean; now: number }
  | { type: 'hint'; now: number }                    // learner pressed 💡 or accepted an offer
  | { type: 'tick'; now: number }
  | { type: 'manualNext'; now: number }
  | { type: 'dismissOffer'; now: number };
export function initRunner(now: number): RunnerState;
export function reduce(lesson: Lesson, s: RunnerState, e: RunnerEvent): RunnerState;
export const IDLE_MS = 45_000; export const FAILS_BEFORE_OFFER = 5;
// content/index.ts
export const course: Lesson[];                       // in order
export function unlockedFor(lessonIndex: number): BlockType[];
```
- Runner rules:
  - `checked` with pass on a non-manual step: advance to the next step (reset `hintLevel`, `failedChecks`, `idleSince`, `offer`). On the last step, set `completed`.
  - `checked` with fail: `failedChecks++`.
  - `manualNext`: advance only when the step's check kind is `manual`.
  - `tick`: set `offer: true` when `hintLevel < 3` and (`now - idleSince ≥ IDLE_MS` or `failedChecks ≥ FAILS_BEFORE_OFFER`).
  - `hint`: `hintLevel++` (max 3), `offer: false`, `failedChecks = 0`, `idleSince = now`.
  - `dismissOffer`: `offer: false`, `idleSince = now`, `failedChecks = 0`.
- **Content validation harness** (`content.test.ts`), the main safety net for every content task. For every lesson and every step:
  - the step's `solution` passes its `check` (skip `manual`, and evaluate `playing` with `playing: true`);
  - for puzzle steps, the effective start program fails the check. The effective start is `start`, or else the previous step's `solution`, or else an empty program;
  - every block type used by `solution` (via `programToWorkspaceState`) is in `unlockedFor(lessonIndex)`;
  - each hint's highlight `blockTypes` are unlocked;
  - if `target` is present, it compiles (`compileForCheck(toCheckExpression(target))` resolves);
  - step ids are unique within the course.

- [ ] **Step 1: Write the failing runner tests**, using a 3-step fixture lesson and explicit `now` values. Cover: pass advances; the last pass completes; 45 000 ms of ticks creates an offer and 44 999 doesn't; 5 failed checks create an offer; `hint` raises the level and clears the offer; level 3 never offers; `manualNext` is ignored on non-manual steps.
- [ ] **Step 2:** Write `content.test.ts` iterating `course`. With an empty `course` it trivially passes, and the content tasks fill it in.
- [ ] **Step 3:** Run. Expected: runner FAIL.
- [ ] **Step 4:** Implement `types.ts`, `runner.ts`, and `content/index.ts` (an empty course for now).
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6: Commit:** `feat: lesson runner with hint ladder and content harness`

---

### Task 11: App shell, session wiring, storage, and sharing

**Files:**
- Create: `src/app/useLessonSession.ts`, `src/app/storage.ts`, `src/app/share.ts`
- Modify: `src/App.tsx`
- Test: `tests/app/storage.test.ts`, `tests/app/share.test.ts`, `tests/app/useLessonSession.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces:
```ts
// storage.ts
export interface SavedState { version: 1; lessonProgress: Record<string, { stepIndex: number; completed: boolean }>; workspaces: Record<string, object> }
export function loadState(): SavedState;              // never throws
export function saveState(s: SavedState): void;       // never throws (quota → console.warn)
export function resetState(): void;
export const STORAGE_KEY = 'ottos-groove-lab:v1';
// share.ts
export function strudelUrl(code: string): string;     // 'https://strudel.cc/#' + encodeURIComponent(base64(utf8(code)))
export async function copyCode(code: string): Promise<boolean>;
// useLessonSession.ts
export function useLessonSession(lessonIndex: number, deps: { engine: AudioEngine; now?: () => number; debounceMs?: number }): {
  lesson: Lesson; runner: RunnerState; program: Program; generated: Generated; evalInfo: EvalInfo | null;
  onBlocksChange(r: { program: Program; warnings: ConvertWarning[]; state: object }): void;
  play(): void; stop(): void; toggleTarget(): void; targetPlaying: boolean; requestHint(): void; acceptOffer(): void; dismissOffer(): void; manualNext(): void;
  loadRequest: { program: Program; nonce: number } | null;
  currentHintText: string | null;
};
```
- Session flow:
  - Each program change → regenerate the code → debounce (`debounceMs`, default 400). Then `engine.update(code)` and `buildContext` → `runCheck` → `reduce({type:'checked'})`.
  - A monotonically increasing sequence number tags each run, and results from older runs are dropped (**Review Focus 4**).
  - A 1 s interval sends `tick`.
  - Hint rung 1 → Otto says `hints[0].say`. Rung 2 → `hints[1].say` plus `highlightBus.emit(hints[1].highlight)`. Rung 3 → "Here, let me show you." and `loadRequest = solution`.
  - On step change with `start`, set `loadRequest = start`. Persist progress and the workspace on every change.
  - Successful checks emit `highlightBus` for the nodes that changed since the previous program (glow both panes), and Otto shows `success` with mood `cheer`.
- App screens:
  1. **Start screen:** Otto asleep, "Click to wake Otto" → `engine.start()`.
  2. **Course map:** modules 0–2 and Acid as a row of lesson cards; locked until the previous lesson is completed; Reset progress with a confirm dialog.
  3. **Lesson view:** a "🎧 hear the goal" button on the stage when the step has a `target`. `toggleTarget` plays the target's code; toggling again, or any workspace change, returns to the learner's program. Stage on top, BlocksPane | CodePane below (the palette is Blockly's toolbox); Copy code and Open in strudel.cc buttons in the code pane header; Back to map.
  4. On lesson completion, Otto cheers and offers "Next lesson →".

- [ ] **Step 1: Write the failing tests:**
  - storage, **Review Focus 5:** `loadState()` with no key → the default; with `'{not json'` → the default; with `{version: 99}` → the default; `saveState` when `localStorage.setItem` throws → doesn't throw.
  - share: `strudelUrl('s("bd")')` === `'https://strudel.cc/#' + encodeURIComponent(btoa('s("bd")'))`; non-ASCII (`'// ♪'`) round-trips via the decode in the test.
  - useLessonSession, **Review Focus 4:** use a fake engine and a fixture course injected through a `course` override param. Two program changes 50 ms apart with `debounceMs: 100` produce exactly one `engine.update` call, with the second program's code. When check run #1 resolves after run #2, the runner reflects only run #2.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Add `course?: Lesson[]` to the `deps` of `useLessonSession` for testability, defaulting to `course`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Manual verification.** Add a one-step fixture lesson temporarily ("make a kick play four times"). In `npm run dev`, in the browser pane: wake Otto → open the lesson → drag an arm and a drum grid, click 4 steps → hear the kick → the step completes and Otto cheers. Press 💡 three times: the nudge, then the glow, then "Show me" loads the solution. Remove the fixture.
- [ ] **Step 6: Commit:** `feat: app shell, lesson session, storage and sharing`

---

### Task 12: Content: Modules 0 and 1 (Hello Otto, Rhythm)

**Files:**
- Create: `src/lessons/content/module0.ts`, `src/lessons/content/module1.ts`
- Modify: `src/lessons/content/index.ts`

**Interfaces:**
- Consumes: the `Lesson` schema (Task 10), `build.ts` helpers (Task 2), `BT` (Task 6).

Dialogue copy is the implementer's to write: Otto's voice, ear first, and every concept named both musically and as code. The lessons, steps, and checks are fixed:

| Lesson id | Title | Unlocks | Steps (type: goal → check) |
|---|---|---|---|
| `m0-hello` | Hello, Otto | `ogl_layer`, `ogl_sound` | guided: drag an arm and a "play sound" block, type `bd` → `hasSound bd`; guided: press ▶ → `playing`; open: change `bd` to `sd`, `hh`, `cp`, then "sounds right" → `manual` |
| `m0-cycle` | The cycle | (none) | guided: `bd sd` → `onsetsPerCycle {}` = 2; puzzle: fit three sounds in one cycle → `onsetsPerCycle {}` = 3; open: "the cycle is the loop; everything squeezes into it" → `manual` |
| `m1-steps` | Steps and rests | `ogl_grid` | guided: `bd ~ sd ~` → `all[onsetsAt bd [0,8], onsetsAt sd [4,12]]`; puzzle: four-on-the-floor with the drum grid → `onsetsAt {s:bd} [0,4,8,12]` |
| `m1-subdiv` | Faster and smaller | (none) | guided: `hh*8` → `onsetsPerCycle {s:hh}` = 8; puzzle: `[ ]` grouping, two hats in beat 2 → `onsetsAt {s:hh}` matches `"hh [hh hh] hh hh"` = `[0,4,6,8,12]` |
| `m1-layers` | Layers (more arms!) | (none) | puzzle: kick and snare on separate arms → `all[layers ≥2, onsetsAt bd [0,4,8,12], onsetsAt sd [4,12]]`; puzzle: add hats on the offbeats → `all[layers ≥3, onsetsAt hh [2,6,10,14]]` |
| `m1-tempo` | Tempo | `ogl_tempo`, `ogl_mod_fast`, `ogl_mod_slow` | guided: set 120 BPM → `tempo 120 ±0`; puzzle: double the hats with `fast` → `onsetsPerCycle {s:hh}` = 8 with the source `hh*4` |
| `m1-machines` | Drum machines | `ogl_bank`, `ogl_mod_gain` | guided: `.bank("RolandTR909")` on the kick → `control bank equals RolandTR909`; puzzle (capstone): rebuild the target groove (909 kick 4/4, clap `cp` on 4 and 12, open hat `oh` on the offbeats, 124 BPM), with `target` set to the solution → `all[…]` |

`m0`–`m1` lessons use `codePane: 'collapsed'` and `spectrum: false`. Each step needs a `label` of 3 words or fewer for the checklist.

- [ ] **Step 1:** Write `module0.ts`, then add it to `course`. Run `npx vitest run tests/lessons/content.test.ts`. Expected: PASS. Fix the content, not the harness, if it fails.
- [ ] **Step 2:** Write `module1.ts`, add it to `course`, and run the harness. Expected: PASS.
- [ ] **Step 3: Manual verification** in the browser pane: play through `m0-hello` and `m1-layers` end to end, including one hint ladder. Confirm every target sounds musical.
- [ ] **Step 4: Commit:** `content: modules 0 and 1`

---

### Task 13: Content: Module 2 (Sound design)

**Files:**
- Create: `src/lessons/content/module2.ts`
- Modify: `src/lessons/content/index.ts`

All Module 2 lessons use `codePane: 'readonly'` and `spectrum: true`. The first lesson's intro tells the learner the code pane is now open, and Otto glows a code span to show the link.

| Lesson id | Title | Unlocks | Steps |
|---|---|---|---|
| `m2-waves` | Waves | `ogl_notes`, `ogl_osc` | guided: `note("c3")` with `.s("sawtooth")` → `control s equals sawtooth`; open: try each oscillator and watch the scope → `manual`; puzzle: the "hollow" sound → `control s equals square` |
| `m2-pitch` | Pitch | (none) | guided: `c2` vs `c3` (octaves) → `distinctNotes ≥2`; puzzle: a 4-note bassline `c2 c2 eb2 c3` (any line with ≥3 distinct notes and 4 onsets) → `all[distinctNotes ≥3, onsetsPerCycle {} = 4]` |
| `m2-filter` | Filters | `ogl_mod_lpf`, `ogl_mod_lpq`, `ogl_mod_hpf`, `ogl_ftype` | guided: lpf 400 on a saw, spectrum view → `control lpf max 1000`; puzzle: resonance → `control lpq min 10`; open: try `ladder` → `manual` |
| `m2-envelope` | Envelopes | `ogl_mod_attack`, `ogl_mod_decay`, `ogl_mod_sustain`, `ogl_mod_release` | guided: slow attack pad → `control attack min 0.3`; puzzle: a short pluck → `all[control decay max 0.3, control sustain max 0.1]` |
| `m2-movement` | Movement | `ogl_signal` | guided: plug a sine into lpf → `controlVaries lpf cycles 4 minSpread 500`; puzzle: a slower sweep → `all[controlVaries lpf …, a signal with slow ≥ 8]`. Express the latter as `control` on the program via a new check `{kind:'signalSlow', control:'lpf', min:8}`: add it to Task 4's union and tests in this task |
| `m2-fenv` | The squelch | `ogl_mod_lpenv`, `ogl_mod_lpa`, `ogl_mod_lpd`, `ogl_mod_lps` | guided: `lpenv 4` → `control lpenv min 2`; puzzle: a short snappy filter envelope → `all[control lpenv min 2, control lpd max 0.2, control lps max 0.2]` |
| `m2-fx` | Space and grit | `ogl_mod_delay`, `ogl_mod_room`, `ogl_mod_distort` | guided: `room` → `control room min 0.2`; guided: `delay` → `control delay min 0.2`; open: `distort` to taste → `manual` |
| `m2-acidline` | Capstone: an acid line | (none) | puzzle: 16th-note saw bassline, resonant, moving cutoff → `all[onsetsPerCycle {s:sawtooth} = 16, control s equals sawtooth, control lpq min 10, any[controlVaries lpf cycles 4 minSpread 500, control lpenv min 2]]` |

- [ ] **Step 1:** Add the `signalSlow` check to `src/checkers/checks.ts` with tests (passes when some layer has a modifier `control` whose arg is a signal with `slow ≥ min`; reads the program, not onsets). Run `npx vitest run tests/checkers`. Expected: PASS.
- [ ] **Step 2:** Write `module2.ts`, add it to `course`, and run the content harness. Expected: PASS.
- [ ] **Step 3: Manual verification:** play `m2-filter`, `m2-movement` and `m2-acidline` in the browser pane. Confirm the spectrum visibly shows the filter sweep, code spans glow when Otto mentions them, and active notes flash in the code pane while playing.
- [ ] **Step 4: Commit:** `content: module 2 sound design`

---

### Task 14: Content: the Acid song

**Files:**
- Create: `src/lessons/content/acid.ts`
- Modify: `src/lessons/content/index.ts`, `src/App.tsx` (course map: a "Song Studio" section with Acid unlocked after Module 2 and the other seven styles shown as locked "coming soon" cards with Otto holding the matching arm)

One lesson, `song-acid`, "Acid", `codePane: 'readonly'`, `spectrum: true`, unlocks nothing new. Each step builds on the previous solution, and Otto explains what defines acid as he goes (the 303, resonance, the squelch, hypnotic repetition):

| Step | Goal | Check |
|---|---|---|
| `acid-kick` | 909 kick, four-on-the-floor, 128 BPM | `all[tempo 128 ±2, onsetsAt {s:bd, bank:RolandTR909} [0,4,8,12]]` |
| `acid-bass` | 16th-note saw line, ≥3 notes, low octave | `all[layers ≥2, onsetsPerCycle {s:sawtooth} = 16, distinctNotes ≥3]` |
| `acid-squelch` | Resonant ladder filter with a moving cutoff and a filter envelope | `all[control ftype equals ladder, control lpq min 10, control lpenv min 2, controlVaries lpf cycles 4 minSpread 500]` |
| `acid-hats` | Offbeat open hats and a clap on 2 and 4 | `all[onsetsAt {s:oh} [2,6,10,14], onsetsAt {s:cp} [4,12]]` |
| `acid-grit` | Distortion and delay on the bass | `all[control distort min 0.2, control delay min 0.2]` |
| `acid-yours` | Make it yours: tweak anything, then share | `manual` (the success line points at Copy and Open in strudel.cc) |

Every puzzle step in this lesson sets `target` to its solution.

- [ ] **Step 1:** Write `acid.ts`, add it to `course`, and run the content harness. Expected: PASS.
- [ ] **Step 2:** Add the Song Studio section to the course map.
- [ ] **Step 3: Manual verification:** play the whole Acid song in the browser pane. It must sound like acid. Tune the solution values (cutoff range, lpq, lpenv, distort) by ear, rerunning the harness after each change. Click Open in strudel.cc and confirm the same code loads and plays there.
- [ ] **Step 4: Commit:** `content: acid song`

---

### Task 15: Deploy to GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1:** Write a workflow on push to `main`: checkout → setup-node 22 → `npm ci` → `npm run lint && npm run typecheck && npm test` → `BASE_PATH=/ottos-groove-lab/ npm run build` → `actions/upload-pages-artifact` (`dist`) → `actions/deploy-pages`.
- [ ] **Step 2:** Run `BASE_PATH=/ottos-groove-lab/ npm run build && npx vite preview --base /ottos-groove-lab/`. Expected: the app loads at `/ottos-groove-lab/` with no 404s for assets.
- [ ] **Step 3: Commit:** `ci: deploy to GitHub Pages`
- [ ] **Step 4: Ask Marc before doing anything outward-facing:** confirm the repo name `Mementoria/ottos-groove-lab` and public visibility. Then `gh repo create Mementoria/ottos-groove-lab --public --source . --push`, enable Pages ("GitHub Actions" source) with `gh api`, and confirm the workflow run succeeds and the site plays audio.
