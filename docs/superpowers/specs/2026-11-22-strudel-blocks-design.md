# Strudel Blocks: Design

**Date:** 2026-11-22
**Status:** Draft, awaiting Marc's approval
**Working title:** "Otto's Groove Lab" (see Naming below)

## 1. Intent and why

Marc watched [*"2 Minute Deep Acid in Strudel (from scratch)"*](https://www.youtube.com/watch?v=HkgV_-nJOuE) and was fascinated: someone types a few lines and a squelchy acid track appears. He wants to understand how that works, but doesn't yet have the foundations, either in music (rhythm, synthesis, harmony, structure) or in Strudel's syntax.

This app is a browser-based, interactive course that teaches Strudel with a Scratch-like block interface. A mascot, **Otto the octopus**, guides the learner from "press play" to building a complete song in one of eight styles.

**Audience:** people like Marc. They're fascinated by automation and systems (programming, factory games like Factorio) and enjoy electronic music, but don't understand the mechanics behind it. They're comfortable with logic and are not children. They don't need programming explained, but they do need music and synthesis explained from the ground up.

**Success looks like:** a learner finishes the course, rewatches that acid video, and can follow what's being typed and why. They can then open strudel.cc and write music on their own.

## 2. Goals, non-goals, anti-goals

### Goals
- Teach the **musical mechanics** (rhythm, cycles, oscillators, filters, envelopes, modulation, scales, chords, structure) and the **Strudel code** that expresses them, together.
- **Ear first:** every concept is heard, then seen on the waveform, then shown as a block, then shown as code.
- **Two equal panes:** blocks and real Strudel code side by side, kept in sync both ways. The learner can work in either one.
- Move the learner **from blocks to code** over the course of the introduction.
- **Hybrid lessons:** guided walkthroughs early on, then goal-driven puzzles. The learner must **always feel guided** and never left to fend for themselves.
- A capstone: **build a full song in one of 8 styles**, guided by Otto step by step.
- Publish as open source in the Mementoria GitHub org.

### Non-goals
- A general-purpose Strudel IDE, or full Strudel feature coverage. The block vocabulary is what the course teaches. Everything else is a "raw code" block.
- Accounts, a backend, cloud sync, or social features.
- Mobile or touch-first support. Desktop-first; tablet may work incidentally.
- Offline use. Samples and soundfonts load from the network.
- Realistic acoustic instruments. General-MIDI-style soundfonts are acceptable (Marc accepted this trade-off).
- Teaching JavaScript in general.

### Anti-goals (failure even if it "works")
- The learner gets stuck on a puzzle with no way forward and feels abandoned.
- Blocks feel like a toy that hides the real code. The code must always be real Strudel that could be pasted into strudel.cc and play the same.
- Lessons that teach syntax without the learner *hearing why it matters*.
- Two-way sync that is flaky: blocks jumping around or code being rewritten unexpectedly while the learner types.
- It sounds bad. Every lesson's target should sound musical, not like a test tone.

## 3. Constraints

- **License:** Strudel packages are AGPL-3.0-or-later, so this app is AGPL-3.0-or-later. Marc confirmed open source is fine.
- **Hosting:** static site, GitHub Pages, in the Mementoria org. No server.
- **Browser audio:** needs a user gesture to start. The first screen has Otto inviting a click to "wake him up," which starts the AudioContext.
- **Network:** Strudel's default sample banks and soundfonts are fetched at runtime.
- **Code quality (Marc's standing rules):** TypeScript strict mode, no `any` in production or test code, and tests held to the same lint and style bar as production.

## 4. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| **A** | **Blockly (Zelos renderer) + Strudel npm packages, in our own Vite/TS/React app** | Drag, snap, undo, keyboard access, and a Scratch-like look come free. Custom in-block widgets (step grids, knobs) and stable two-way sync take some work against Blockly's internals. | **Chosen** |
| B | Hand-built block editor (React + drag-and-drop library), lane-based | Total control: in-block widgets are trivial and sync is cleaner, because the blocks *are* the parsed code structure. But weeks of editor work before any teaching, polish risk, and a less literally Scratch-like feel. | Rejected for time and risk |
| C | Fork Strudel's own REPL website and add a blocks panel | Inherits sharing and visuals, but means a heavy monorepo, upstream drift, and lessons and Otto bolted onto someone else's app. | Rejected |

Marc picked **A**: it gets lessons in front of learners fastest and delivers the true Scratch feel. Blockly could be swapped out later if it becomes a limit.

### Stack (decided, as part of A)
- Vite + TypeScript (strict) + React for the app shell, stage, Otto, and lesson UI.
- **Blockly** (Apache-2.0) with the **Zelos** renderer for the blocks pane.
- **@strudel/web** for evaluation and playback (`initStrudel`, `evaluate`, `hush`), plus **@strudel/soundfonts** for acoustic instruments.
- **@strudel/codemirror** for the code pane: Strudel syntax highlighting and active-event highlighting.
- **acorn** (already a dependency of `@strudel/transpiler`) to parse code for the code → blocks direction.
- Vitest for unit tests. Deployment via GitHub Actions to Pages.

## 5. The experience (decided with Marc)

### 5.1 Screen layout: "The Stage" with an inline checklist

```
┌─ STAGE ───────────────────────────────────────────────────────┐
│ Acid · 3/5      │  🐙  "Make it squelch! Sweep the      ∿∿∿∿∿∿∿   │
│ ✓ saw bass      │       filter cutoff."               waveform  │
│ ✓ notes         │                                    [💡 hint]  │
│ ▶ filter sweep  │                                    [▶ / ■]    │
│ ○ resonance     │                                               │
│ ○ add kick      │                                               │
├─ palette ─┬─ blocks ─────────────┬─ strudel code ─────────────┤
│ sound     │ [note c2 c2 eb2 c3]  │ note("c2 c2 eb2 c3")        │
│ notes     │ [sound sawtooth]     │   .s("sawtooth")            │
│ filter    │ [lpf ⟿ sine 200→2k]  │   .lpf(sine.range(200,2000))│
└───────────┴──────────────────────┴─────────────────────────────┘
```

- **Stage (top, full width):** on the left, a compact lesson checklist that's always visible (the current step highlighted, completed steps ticked, upcoming steps listed). In the middle, Otto and his speech bubble. On the right, the live waveform, plus play/stop and the hint button.
- **Bottom:** the block palette, the blocks workspace, and the Strudel code pane, side by side at full width.
- The palette only shows blocks the learner has unlocked so far.

### 5.2 Otto
- An octopus with headphones, rendered as SVG (see the approved mockup in `.superpowers/brainstorm/`). Referred to as "he."
- **Animated to the music:** his tentacles sway on the beat, and he bobs harder as the sound gets louder. The animation is driven by Strudel's cycle position (the beat phase) and the output level (RMS from an analyser).
- **Teaches through speech bubbles:** short and friendly. He addresses an adult and doesn't talk down.
- **Points at things:** when he mentions `lpf`, the matching block *and* the code span glow. On the stage he can gesture at the waveform when it changes.
- Eight arms map onto the eight song styles, and onto layers in a song. This is a theme to lean on in visuals and copy, not a hard mechanic.

### 5.3 Two-way sync (decided: option B, "two-way over the taught vocabulary")
- Editing blocks regenerates the code. Editing code re-parses it and updates the blocks.
- Code → blocks covers the **supported vocabulary** (Section 7). Any expression the mapper doesn't recognise becomes a grey **raw code block** that holds the source text verbatim and still plays.
- Generated code must be real Strudel that plays identically when pasted into strudel.cc.
- **Program shape: a list of `$:` layers.** This is current Strudel idiom (and what learners will see on strudel.cc and in videos). Each `$:` line is one layer; each top-level block stack in the workspace is one layer, so the two map 1:1 and line up with Otto's arms. `stack()` is still supported as a block inside a layer. `setcpm(n)` is a separate global block/line. A layer can be muted (`_$:`) from its block. *(Builder's call, made during review.)*
- **Formatting is preserved per layer.** A block edit regenerates only the text of the layer it touched, in a deterministic standard layout; every other layer keeps its exact source text, including comments. Comments directly above a `$:` line stay attached to that layer. Comments *inside* a layer that's edited from blocks may be lost. That's acceptable, and Otto mentions it the first time it happens. Full character-level surgical patching is out of scope. *(Builder's call, made during review.)*
- Sync must be stable. Blocks keep their identity and position across edits wherever possible, and code formatting isn't churned on every block change. Code → blocks runs on a short debounce and only when the code parses; while the code is invalid, the blocks keep their last good state and show a small "code has an error" indicator.

### 5.4 Code-pane progression
Learners are walked from blocks toward code during the introduction:

| Stage of the course | Code pane |
|---|---|
| Module 0–1 | Collapsed by default, with a "peek at the code" toggle. Otto encourages peeking. |
| Module 2 | Visible and read-only. Code spans highlight when the matching block is touched, and active notes flash as they play. |
| Module 3 onward | Editable. Two-way sync is live. |
| Module 4 onward | Some puzzle goals say "try this one in the code pane." |
| Song Studio | Fully open. The learner uses whichever pane they like. |

### 5.5 Lesson format: hybrid puzzles with a hint ladder
Each lesson is a sequence of **steps**. A step is either:
- **Guided:** Otto explains, the learner performs a specific action, and the step completes automatically when the action is detected.
- **Puzzle:** Otto explains the concept, then sets a goal ("rebuild this groove," "make the bass squelch"). It completes when a checker passes. Puzzles may come with a **target audio** to listen to and compare against.
- **Open:** creative freedom with a loose requirement. It completes on the checker *or* on a "sounds right to me →" button, used for taste-based steps.

**Hint ladder (always available via 💡):**
1. **Nudge:** a conceptual question or reminder ("what controls brightness?").
2. **Point:** highlights the relevant palette block(s) and/or code location.
3. **Show me:** Otto builds the solution, or the missing piece, into the workspace.

If the learner is idle on a puzzle for about 45 seconds, or makes several attempts that fail the checker, Otto proactively offers the next hint rung. Nobody is ever stuck.

**Checkers check what the music does, not the text.** Wherever possible a checker queries the evaluated Strudel pattern for its events over the first N cycles (`pattern.queryArc`) and checks properties: "the kick hits 4 times per cycle," "the notes stay within C minor," "the lpf value varies over time." That way any equivalent solution passes, whether it was built in blocks or code. Structural checks on the parsed code are the fallback where event queries can't tell (for example "uses `.room()`").

### 5.6 Curriculum arc
Intro modules, then the Song Studio. Lesson granularity and exact copy are left to the builder; the arc and concepts are decided.

| Module | Teaches (music) | Teaches (Strudel) |
|---|---|---|
| **0. Hello, Otto** | What a loop is; press play | `s("bd")`, play/stop, the **cycle** |
| **1. Rhythm** | Beats in a bar, subdivisions, rests, layering, tempo | mini-notation: `"bd sd"`, `[ ]`, `~`, `*`, `,` / `stack()`, `setcpm`, `.fast/.slow`, sample banks `.bank()` |
| **2. Sound design** | Oscillators (and what their waves look like), pitch, filters and resonance, envelopes, modulation (LFOs), effects | `note()`, `s("sawtooth")` etc., `.lpf/.lpq`, the filter envelope (`.lpenv .lpa .lpd .lps`, the heart of acid "squelch" and accents), `.attack/.decay/.sustain/.release`, `sine.range().slow()`, `.delay`, `.room`, `.distort`. **Capstone puzzle: a squelchy acid line** |
| **3. Notes and scales** | Scales, degrees, octaves, melody | `n("0 2 4").scale("C:minor")`, `<>` alternation, octave shifts. **The code pane becomes editable** |
| **4. Chords and harmony** | Chords, progressions, roots and bass, arpeggios, seventh chords | `chord("<Am F C G>").voicing()`, deriving the bass, `.arp()` |
| **5. Structure and variation** | Sections, repetition vs change, build-ups, randomness | `<>` across cycles, `.every()`, `.sometimes()`, `.degradeBy()`, `.mask()`, `arrange()` |
| **Song Studio** | Pick one of 8 styles; Otto guides a full song build | Everything above |

### 5.7 Song Studio: eight styles
Each style is a guided multi-step build (roughly 5–8 steps: drums → bass → harmony → melody/hook → sound polish → structure). Otto explains what *defines* the style as he goes.

| Style | Tempo (approx.) | Defining ideas it teaches |
|---|---|---|
| **Acid** | 125–130 BPM | Four-on-the-floor; 16th-note sawtooth line; resonant low-pass with swept cutoff; accents; distortion and delay |
| **House** | 120–124 | Four-on-the-floor; offbeat open hats; clap on 2 and 4; seventh-chord stabs; groovy bassline |
| **Techno** | 130–135 | Driving kick and rumble; hypnotic short loops; subtle variation with `.sometimes`; minimalism |
| **Lo-fi hip hop** | 70–85 | Swung, lazy drums (`.swing`); jazzy seventh chords on an electric-piano soundfont; low-pass "warmth"; pentatonic melody |
| **Ambient** | slow | Pads with long attack and release; big reverb; sparse random notes (`.degradeBy`); slow modulation |
| **Classical** | moderate | Scales and arpeggios; Alberti-style broken chords; two-voice counterpoint; cadences; soundfont piano and strings |
| **Jazz** | medium swing | Swing feel; ii–V–I with seventh chords and voicings; walking bass; ride-cymbal pattern |
| **Pop** | 100–120 | The four-chord loop (I–V–vi–IV); a melodic hook; song structure (verse → chorus) with `arrange()` |

### 5.8 Waveform
- An oscilloscope (time-domain) view on the stage, the default.
- A spectrum view becomes available from Module 2's filter lessons, because filter sweeps are far more visible on a spectrum. *(Builder's call; noted as such.)*
- It's fed by an analyser on Strudel's output, and the same signal drives Otto's animation.

### 5.9 Persistence and sharing
- Everything is saved automatically to `localStorage`: course progress, per-lesson workspaces, and Song Studio songs.
- Reset progress (with confirmation).
- **Share:** "Copy Strudel code" to the clipboard, and "Open in strudel.cc," which encodes the code into a strudel.cc URL.

## 6. Architecture (outline for the builder)

Modules and their responsibilities:

- **audio/**: wraps `@strudel/web`. Init on the first user gesture; `play(code)`, `stop()`; exposes the current cycle position and an analyser node; loads the default sample banks and soundfonts.
- **blocks/**: Blockly block definitions (one per vocabulary item), the toolbox built from the learner's unlocked set, a Zelos theme, and custom fields (at minimum a **step-grid field** for drum patterns and a **number knob/slider**).
- **codegen/**: blocks → Strudel code.
- **parse/**: Strudel code → a small intermediate model of the supported vocabulary (via acorn) → blocks. Unrecognised nodes become raw code blocks.
- **sync/**: owns the single source of truth for the current program, debounces, preserves block identity, and avoids feedback loops between panes.
- **lessons/**: lesson and step schema (data, not code where possible), the lesson runner, the hint ladder, and idle detection.
- **checkers/**: reusable check functions over pattern events and over the parsed model.
- **otto/**: the SVG character, animation driven by beat phase and RMS, the speech-bubble queue, and highlight/point requests.
- **stage/**: the checklist, waveform/spectrum canvas, and transport controls.
- **storage/**: versioned localStorage persistence.

**A lesson step's data** includes, at minimum: Otto's dialogue lines; the step type (guided, puzzle, or open); the starting program (optional); the unlocked blocks; the code-pane mode; the checker reference and parameters; three hint rungs (text, highlight targets, and a "show me" program or patch); and an optional target-audio program for comparison.

## 7. Supported vocabulary (blocks ↔ code)

This vocabulary is the set of constructs the lessons teach. It's the floor, and the builder may add more where it's cheap.

- **Sources:** `s("…")`, `sound("…")`, `note("…")`, `n("…")`, `chord("…")`
- **Mini-notation strings:** edited as text fields. A **step-grid field** is used where the string is a simple single-sound sequence of 8 or 16 steps.
- **Combination:** `stack(a, b, …)`, `arrange([n, a], …)`
- **Program structure:** `$:` layers, `_$:` muted layers
- **Modifiers:** `.s .bank .scale .voicing .arp .fast .slow .gain .pan .lpf .lpq .hpf .lpenv .lpa .lpd .lps .ftype .attack .decay .sustain .release .delay .room .distort .swing .every .sometimes .degradeBy .mask`
- **Signals as arguments:** `sine`, `saw`, `square`, `tri`, `perlin`, with `.range(a,b)` and `.slow(n)`
- **Global:** `setcpm(n)`
- **Anything else:** a raw code block.

## 8. Release plan (decided with Marc: vertical slice first)

The repo is public in the Mementoria org from the first commit, and deploys to GitHub Pages from milestone 1.

1. **Milestone 1: playable slice.** Audio engine, the stage, Otto (animated), the waveform, Blockly with blocks → code, the code pane in collapsed and read-only modes, the lesson runner with the hint ladder and checkers, localStorage, and sharing. Content: **Modules 0–2 and the Acid song.** Code → blocks parsing isn't needed yet, because the code pane is read-only before Module 3.
2. **Milestone 2: the code bridge.** Code → blocks parsing, the full two-way sync (Section 5.3), the editable code pane, raw code blocks. Content: **Modules 3–5.**
3. **Milestone 3+: Song Studio styles.** The remaining seven styles, in batches (suggested order: House, Techno, Pop, Lo-fi, Jazz, Ambient, Classical).

Each milestone gets its own implementation plan. The first plan covers milestone 1.

## 9. Naming

The folder is `Strudel-Scratch`, but "Scratch" is a trademark of the Scratch Foundation, which restricts its use in other products' names. The public name should avoid it. **Working title: "Otto's Groove Lab"** (builder's call; Marc may rename). The repo name can follow.

## 10. Left to the builder
- Visual style beyond the approved mockups: colours, typography, block colours per category.
- Otto's final illustration and animation details, within Section 5.2.
- Exact lesson count, step breakdown, and all dialogue copy, within the arc in 5.6 and 5.7.
- The idle and failed-attempt thresholds for proactive hints (a starting value is given above).
- Whether target-audio comparison is a play button, an A/B toggle, or both.
- The internal data format for lessons (TS modules vs JSON).
- The test strategy beyond unit tests for codegen/parse round-trips and checkers.
