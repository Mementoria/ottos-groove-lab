# Milestone 1: follow-ups and decisions

These were deferred from milestone 1's reviews, or decided during the build. None of them blocked merge.

## Needs Marc's ears (nobody has listened yet)

- **Acid song:** overall loudness with `lpq` 16 + ladder + `distort` 0.4 and the kick at gain 1; whether the `c1` notes are audible on laptop speakers; open hats at 0.6; how much the 0.3 delay smears the line.
- **Module 2:** resonance 12–15 on the default filter (`m2-filter-res`); the 24db filter with resonance 12 may jump in volume.
- **Module 1 capstone:** open-hat level (0.6).
- **Spectrum view:** the dB range (-100 to -20) is a guess.

## Content pass

- Rests step: `bd ~ sd ~` sounds the same as `bd sd`. Otto should say so ("a rest holds a place").
- Explain "eighth-note" and "sixteenths" when they first come up. "Sooner or later" is ambiguous in m0-cycle.
- Arm hint says "type bd", but the default `bd sd` already passes. m1-tempo says "try both", but the step completes first.
- Some guided steps pass with a fresh block's default value (lpf 800, room, delay, lpenv). Tighten them, e.g. `m2-filter-cut` max 500.
- Module 2 copy nits: "same bass, same cutoff"; "its own ADSR" lists three knobs; delay echoes land three steps behind, not "between the notes"; "recordings of real drums"; "Find hollow".
- Acid copy: "full with a volume of 1" (gain can go above 1); "every acid track"; `acid-bass` rejects lines with rests because it requires exactly 16 onsets.
- Equivalent answers that are still rejected: a pluck made with decay alone; the default low-pass envelope in `m2-fenv-snap`.
- `,` / `stack()` (the spec's Module 1 list) is not taught yet. It's deferred to milestone 2 vocabulary (ruling R17).

## Engineering

- **Typo bubble:** Otto's typo line outlives the fix and replaces the step intro. The `targetCode` guard should also check `targetPlaying`.
- **Engine and session:** a previous lesson's playback can stop the shared engine (add an owner token). A stalled sample load shows "Loading sounds…" forever with no Retry. The listener in `setStatus` isn't isolated from errors.
- **Saved workspaces:** an unloadable saved workspace falls back to empty instead of the step's effective start. Fix this before any release that removes or renames a block type.
- **Blocks:** a disabled signal block is still read. The step grid has no full-size click target. `getText_` returns raw `x...` (bad for accessibility). Highlighting a palette category needs a per-category refcount. Blockly 13 toolbox internals are relied on, so consider pinning `blockly` exactly.
- **Checks:**
  - `signalRange` and `signalSlow` have no `where` and ignore whether a layer will actually render.
  - The capstone's `signalRange` has no `where: SAW`.
  - Empty `all` is guarded only by the harness.
- **UI:**
  - The success glow is broader now that layers have spans.
  - Rung 2 on a signal also glows the modifier it plugs into.
  - The reset dialog has no focus trap.
  - "Coming soon" cards are disabled buttons.
  - The rAF loop idles while stopped.
  - The spectrum state isn't reset when spectrum becomes unavailable.
- **Tests:**
  - No LessonView-level tests.
  - The BlocksPane `extraWarnings` merge is untested.
  - Otto's animation is untested.
  - Scope is tested only for the null-context case.
  - The test named "fixing it clears both" asserts only one thing.
- **Size:** `useLessonSession.ts` is about 550 lines; extract `createPlayback`.
- **CI:** no CI runs on pull requests (only on push to main).

## Decisions made during the build (rulings)

- **R3:** `control` and `controlVaries` checks take an optional `where` to target one layer.
- **R5:** BlocksPane `initial` is a tagged union, `{kind:'program'} | {kind:'saved'}`.
- **R8:** check data uses Strudel method names (`lpf`), mapped to hap keys (`cutoff`) through `controlKey`.
- **R10:** the content harness requires every lesson program to round-trip through blocks with zero warnings.
- **R11:** touching a block glows its code span (owned by BlocksPane).
- **R12:** an inserted Task 11b covers palette hints, a readable toolbox, open steps ("Sounds right to me →"), and a start screen that doesn't wait on sample loading.
- **R13:** the m1-steps rests step uses the goal `bd ~ sd ~ bd ~ sd ~` (the plan's pattern contradicted its own check).
- **R14 / R15:** the acid checks require a real cutoff, and a sweep passes by its range (`signalRange`), not by a 4-cycle window.
- **R16:** the final fix wave: typo warnings, hints glowing code spans, lazy-loaded LessonView, a CI format check, undo kept after "Show me".
- **R17:** `stack()` / `,` deferred to milestone 2.
- **Dev note:** after adding dependencies mid-session, clear `node_modules/.vite` if the console shows CodeMirror "multiple instances" or `.p is not a function`. It's a stale Vite optimizer cache, not a code bug.
