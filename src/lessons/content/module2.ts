import { BT, modBlockType } from '../../blocks/blockIds';
import { ftype, layer, mod, notes, osc, program, signal } from '../../program/build';
import type { Layer, Modifier, Program } from '../../program/types';
import type { Lesson } from '../types';

/** The pitch puzzle's bassline, reused while we learn to filter it. */
const BASSLINE = 'c2 c2 eb2 c3';
/** Eight notes for the LFO lesson: the first half of the acid line. */
const GROOVE = 'c2 c2 c3 c2 eb2 c2 bb2 c2';
/** Sixteen notes per cycle, the classic acid pace. */
const ACID = 'c2 c2 c3 c2 eb2 c2 bb2 c2 c2 c2 c3 eb2 g2 c2 bb1 c3';
const PAD_CHORDS = '[c3,eb3,g3] [ab2,c3,eb3]';
const ARPEGGIO = 'c3 eb3 g3 c4 g3 eb3 c3 g2';

const saw = (mini: string): Layer => layer(notes(mini), osc('sawtooth'));

/* ---------- Waves ---------- */

const lonelyNote = notes('c3');

const waves: Lesson = {
  id: 'm2-waves',
  module: 2,
  title: 'Waves',
  unlocks: [BT.notes, BT.osc],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-waves-saw',
      label: 'Pick a sawtooth',
      type: 'guided',
      say: [
        "Welcome to Module 2: sound design! Look to the right: the **Strudel code** pane is open for good now. It's read-only. You build with blocks, and it shows the Strudel they write.",
        'Here is a new block, **play notes**. Click it and watch its line in the code, **note("c3")**, light up. Every block you touch glows like that.',
        "Until now you've played samples, recordings of real drums. **play notes** is different: a synthesizer builds each note from scratch, out of a repeating wave.",
        "Press ▶ and listen to this C: soft and round. That's the synth's default wave, a triangle.",
        'Now snap a **with sound** block under it and pick **sawtooth**. Listen, then watch how the wave changes shape.',
      ],
      start: program(null, layer(lonelyNote)),
      check: { kind: 'control', control: 's', equals: 'sawtooth' },
      hints: [
        {
          say: "The note is fine; it's the wave you want to change. That block lives in **Sounds**.",
        },
        {
          say: 'Snap a **with sound** block from **Sounds** under the **play notes** block and pick **sawtooth**.',
          highlight: { blockTypes: [BT.osc], nodeIds: [lonelyNote.id] },
        },
      ],
      solution: program(null, layer(lonelyNote, osc('sawtooth'))),
      success:
        'Buzzy! Same note, same pitch, a completely different character. In code it reads **.s("sawtooth")**: s picks the sound, here a synth wave.',
    },
    {
      id: 'm2-waves-try',
      label: 'Try all four',
      type: 'open',
      say: [
        'Synths have four classic waves. Switch the **with sound** dropdown through **sawtooth**, **square**, **triangle** and **sine**, and listen to each one.',
        'The difference is overtones: fainter, higher frequencies stacked on top of the note you hear. More overtones, brighter sound.',
        '**sawtooth** is a ramp and has every overtone, so it buzzes. **sine** is the smoothest curve there is and has none: pure, almost a whistle. **triangle** sits close to sine, soft and mellow.',
        "I'll let you judge **square** for yourself. Tell me when you've heard all four.",
      ],
      check: { kind: 'manual' },
      hints: [
        {
          say: 'Click the dropdown on the **with sound** block. It changes the wave while it plays.',
        },
        {
          say: 'Open the **with sound** dropdown and pick each wave in turn, listening for a few seconds each.',
          highlight: { blockTypes: [BT.osc] },
        },
      ],
      solution: program(null, layer(lonelyNote, osc('sine'))),
      success:
        'Four waves, four characters. Almost every synth sound you know starts from one of them.',
    },
    {
      id: 'm2-waves-hollow',
      label: 'Find hollow',
      type: 'puzzle',
      say: [
        "Ear puzzle! I'm back on sawtooth. Press 🎧 hear the goal to hear one of the other waves.",
        'It sounds hollow, a bit like a clarinet or an old game console. Which wave is it? Find it with your **with sound** block.',
      ],
      start: program(null, layer(lonelyNote, osc('sawtooth'))),
      check: { kind: 'control', control: 's', equals: 'square' },
      hints: [
        {
          say: "It's not the brightest wave and not the softest. On the scope it jumps straight up and down.",
        },
        {
          say: 'Pick **square** in the **with sound** block.',
          highlight: { blockTypes: [BT.osc] },
        },
      ],
      solution: program(null, layer(lonelyNote, osc('square'))),
      target: program(null, layer(lonelyNote, osc('square'))),
      success:
        'Square! It only has every other overtone, the odd ones, and that gap is what your ear hears as hollow. Hello, chiptune.',
    },
  ],
};

/* ---------- Pitch ---------- */

const pitchNote = notes('c3');
const bassline = (): Program => program(null, saw(BASSLINE));

const pitch: Lesson = {
  id: 'm2-pitch',
  module: 2,
  title: 'Pitch',
  unlocks: [],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-pitch-octave',
      label: 'Drop an octave',
      type: 'guided',
      say: [
        'Notes have names: a letter for the note, and a number for the octave. **c3** is a C in octave 3.',
        'Go up one octave and the wave wiggles twice as fast. Your ear hears the same note, just higher.',
        'Change the pattern to **c2 c3**: a low C, then the same C an octave up. Listen, and watch the wave squeeze.',
      ],
      start: program(null, layer(pitchNote, osc('sawtooth'))),
      check: { kind: 'distinctNotes', min: 2 },
      hints: [
        { say: 'Notes go in a row with spaces between them, just like **bd sd** did.' },
        {
          say: 'In the **play notes** block, type **c2 c3**.',
          highlight: { blockTypes: [BT.notes], nodeIds: [pitchNote.id] },
        },
      ],
      solution: program(null, saw('c2 c3')),
      success:
        'Same note, an octave apart. Down in octave 2 is bass territory, and that is where acid lines live.',
    },
    {
      id: 'm2-pitch-bass',
      label: 'Write a bassline',
      type: 'puzzle',
      say: [
        'Between one C and the next come d, e, f, g, a and b. Add a **b** after a letter for flat, a half step lower: **eb2** is E flat.',
        'Puzzle: write a four-note bassline that uses at least three different notes.',
        'Press 🎧 hear the goal to hear one I like. Borrow it, or write your own.',
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'distinctNotes', min: 3 },
          { kind: 'onsetsPerCycle', where: {}, count: 4 },
        ],
      },
      hints: [
        {
          say: 'Four notes, spaces between them. You can repeat one, as long as three are different.',
        },
        {
          say: 'Type **c2 c2 eb2 c3** in the **play notes** block: low C twice, an E flat, then C an octave up.',
          highlight: { blockTypes: [BT.notes] },
        },
      ],
      solution: bassline(),
      target: bassline(),
      success:
        "That's a bassline! Low notes, a little movement, and a jump up the octave to keep it bouncing.",
    },
  ],
};

/* ---------- Filters ---------- */

const filtered = (...extra: Modifier[]): Program =>
  program(null, layer(notes(BASSLINE), osc('sawtooth'), mod('lpf', 400), ...extra));

const filter: Lesson = {
  id: 'm2-filter',
  module: 2,
  title: 'Filters',
  unlocks: [modBlockType('lpf'), modBlockType('lpq'), modBlockType('hpf'), BT.ftype],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-filter-cut',
      label: 'Close the filter',
      type: 'guided',
      say: [
        "Here's your bassline on a sawtooth. Remember those overtones that make it buzz? A filter decides how many get through.",
        'Press **Spectrum** under the wave. Now you see the sound as frequencies: lows on the left, highs on the right. Every peak is one overtone.',
        'Snap a **filter cutoff** block under the bassline and set it to 400. It is a low-pass filter: the lows pass, and everything above 400 Hz gets cut.',
        'Listen to the buzz go dark, and watch the right side of the spectrum fall away.',
      ],
      start: bassline(),
      check: { kind: 'control', control: 'lpf', max: 1000 },
      hints: [
        { say: 'Filters live in the **Filter** drawer. You want the one that cuts the highs.' },
        {
          say: 'Snap a **filter cutoff** block under **with sound** and type 400.',
          highlight: { blockTypes: [modBlockType('lpf')] },
        },
      ],
      solution: filtered(),
      success:
        'From buzzy to dark! That is **.lpf**, a low-pass filter, and its number is the cutoff in Hz. Try 400, 200, 2000 while it plays: this is the knob every acid track twists.',
    },
    {
      id: 'm2-filter-res',
      label: 'Add resonance',
      type: 'puzzle',
      say: [
        'Filters have a second knob: **resonance**. It boosts the frequencies right at the cutoff, so the filter starts to sing.',
        'Puzzle: press 🎧 hear the goal. Same bass, same cutoff, but it rings. Make yours match.',
        'You want a **resonance** block, turned up past 10. Watch for a sharp peak in the spectrum, right at the cutoff.',
      ],
      check: { kind: 'control', control: 'lpq', min: 10 },
      hints: [
        { say: 'A fresh resonance block starts gentle. It needs to go higher than that to ring.' },
        {
          say: 'Snap a **resonance** block under the **filter cutoff** and set it to 12.',
          highlight: { blockTypes: [modBlockType('lpq')] },
        },
      ],
      solution: filtered(mod('lpq', 12)),
      target: filtered(mod('lpq', 12)),
      success:
        'Hear that rubbery whistle? That is **.lpq**, resonance. A resonant filter is half the acid sound already.',
    },
    {
      id: 'm2-filter-ladder',
      label: 'Try ladder',
      type: 'open',
      say: [
        'One more filter control: **filter type**. **12db** cuts the highs gently, **24db** cuts them steeper.',
        '**ladder** copies the warm analog filters of old synths, a close cousin of the one in the Roland TB-303, the little bass machine that started acid house.',
        'Snap a **filter type** block under your bass and switch between all three. Ladder is steep, squelchy, and it can growl.',
        'Bonus: **high-pass** is the mirror image, cutting the lows instead. Filter type changes it too, and ladder only does low-pass, so switch back to **12db** before you try it. Then tell me when it sounds right.',
      ],
      check: { kind: 'manual' },
      hints: [
        { say: '**filter type** is in the **Filter** drawer. Change its dropdown while it plays.' },
        {
          say: 'Snap **filter type** under the **resonance** block and pick **ladder**.',
          highlight: { blockTypes: [BT.ftype] },
        },
      ],
      solution: filtered(mod('lpq', 12), ftype('ladder')),
      success:
        'That\'s **.ftype("ladder")**, and it is the filter we\'ll use for the acid sounds ahead.',
    },
  ],
};

/* ---------- Envelopes ---------- */

const pad = (...extra: Modifier[]): Program =>
  program(null, layer(notes(PAD_CHORDS), osc('sawtooth'), mod('lpf', 1200), ...extra));
const arpeggio = (...extra: Modifier[]): Program =>
  program(null, layer(notes(ARPEGGIO), osc('sawtooth'), mod('lpf', 2000), ...extra));

const envelope: Lesson = {
  id: 'm2-envelope',
  module: 2,
  title: 'Envelopes',
  unlocks: [
    modBlockType('attack'),
    modBlockType('decay'),
    modBlockType('sustain'),
    modBlockType('release'),
  ],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-env-pad',
      label: 'Slow attack',
      type: 'guided',
      say: [
        "Every note has a shape in time: how it starts, holds and ends. That's its **envelope**, and synths set it with four knobs, ADSR.",
        '**attack** is how long a note takes to fade in. **decay** is how fast it falls after that first peak. **sustain** is the level it holds while the note lasts. **release** is how long it rings out once the note ends.',
        'Here are two chords (commas stack notes on top of each other). Listen: each one starts with a hard edge.',
        'Snap an **attack** block under them and set it to 0.5 seconds. Hear the chords swell in, like a string section.',
      ],
      start: pad(),
      check: { kind: 'control', control: 'attack', min: 0.3 },
      hints: [
        { say: 'The fade-in is the attack. It counts in seconds, so 0.5 is half a second.' },
        {
          say: 'Snap an **attack** block from **Envelope** under the **filter cutoff** and set it to 0.5.',
          highlight: { blockTypes: [modBlockType('attack')] },
        },
      ],
      solution: pad(mod('attack', 0.5)),
      success:
        'A pad! Soft, slow sounds like this fill the background of a track, and one **.attack** was all it took.',
    },
    {
      id: 'm2-env-pluck',
      label: 'Make a pluck',
      type: 'puzzle',
      say: [
        'Now the opposite. A **pluck** hits and dies away fast, like a plucked string.',
        'Here is an arpeggio, a chord played one note at a time. Right now every note holds steady until the next one.',
        'Puzzle: make it pluck. Give each note a short **decay**, 0.3 seconds or less, and drop the **sustain** to almost nothing (0.1 or less). 🎧 hear the goal has mine.',
      ],
      start: arpeggio(),
      check: {
        kind: 'all',
        checks: [
          { kind: 'control', control: 'decay', max: 0.3 },
          { kind: 'control', control: 'sustain', max: 0.1 },
        ],
      },
      hints: [
        {
          say: 'With a high sustain, a note just sits there. Bring sustain near 0 and let a short decay fade it out.',
        },
        {
          say: 'Snap a **decay** block set to 0.15 and a **sustain** block set to 0 under the arpeggio.',
          highlight: { blockTypes: [modBlockType('decay'), modBlockType('sustain')] },
        },
      ],
      solution: arpeggio(mod('decay', 0.15), mod('sustain', 0)),
      target: arpeggio(mod('decay', 0.15), mod('sustain', 0)),
      success:
        'Pluck, pluck, pluck! Short decay, no sustain: each note gets one burst and then it is gone. Same notes as before, totally different feel.',
    },
  ],
};

/* ---------- Movement ---------- */

const fixedCutoff = mod('lpf', 400);
const sweeping = (slow: number): Program =>
  program(
    null,
    layer(
      notes(GROOVE),
      osc('sawtooth'),
      mod('lpf', signal('sine', 200, 2000, slow)),
      mod('lpq', 12),
      ftype('ladder'),
    ),
  );

const movement: Lesson = {
  id: 'm2-movement',
  module: 2,
  title: 'Movement',
  unlocks: [BT.signal],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-move-lfo',
      label: 'Add an LFO',
      type: 'guided',
      say: [
        'So far every knob stays exactly where you leave it. Real tracks move: the filter opens and closes as the music goes.',
        'You could twist it by hand forever. Or you build a little machine that twists it for you. That machine is an **LFO**, a low-frequency oscillator: a wave too slow to hear, used to move a knob.',
        'Grab the **sine wave** block from **Movement** and drop it into the number slot of **filter cutoff**, right on the 400. It sweeps the cutoff from 200 to 2000 and back, every 4 cycles.',
        'Listen to the bass open up and close again, and watch the spectrum breathe.',
      ],
      start: program(
        null,
        layer(notes(GROOVE), osc('sawtooth'), fixedCutoff, mod('lpq', 12), ftype('ladder')),
      ),
      check: { kind: 'controlVaries', control: 'lpf', cycles: 4, minSpread: 500 },
      hints: [
        {
          say: "The wave block doesn't hang under the bass. It plugs into a number slot, like a cable into a socket.",
        },
        {
          say: 'Drag the wave block from **Movement** onto the 400 in the **filter cutoff** block.',
          highlight: { blockTypes: [BT.signal], nodeIds: [fixedCutoff.id] },
        },
      ],
      solution: sweeping(4),
      success:
        'It breathes! In code that is **sine.range(200, 2000).slow(4)**: a sine wave, stretched between two numbers, slowed down to take 4 cycles.',
    },
    {
      id: 'm2-move-slow',
      label: 'Slow the sweep',
      type: 'puzzle',
      say: [
        'That sweep is a bit busy. Acid tracks like to take their time, so the build creeps up on you.',
        'Puzzle: keep the filter opening and closing, but make one sweep take 8 cycles or more. 🎧 hear the goal has mine.',
      ],
      check: {
        kind: 'all',
        // Read from the program: a slow sweep barely moves inside the 4-cycle onset window, and
        // a square wave sits on one value for half its period.
        checks: [
          { kind: 'signalRange', control: 'lpf', minSpread: 500 },
          { kind: 'signalSlow', control: 'lpf', min: 8 },
        ],
      },
      hints: [
        {
          say: 'The wave block has its own clock: the last number says how many cycles one sweep takes.',
        },
        {
          say: 'In the **sine wave** block, change **over 4 cycles** to 8.',
          highlight: { blockTypes: [BT.signal] },
        },
      ],
      solution: sweeping(8),
      target: sweeping(8),
      success:
        'Slow and hypnotic. The **.slow** number stretches one sweep over that many cycles: 8 cycles is about 16 seconds at this tempo.',
    },
  ],
};

/* ---------- Filter envelope ---------- */

const acidBase = (...extra: Modifier[]): Program =>
  program(
    null,
    layer(notes(ACID), osc('sawtooth'), mod('lpf', 300), mod('lpq', 12), ftype('ladder'), ...extra),
  );
const lazyDecay = mod('lpd', 0.6);
const lazySustain = mod('lps', 0.5);
const snappy = (...extra: Modifier[]): Program =>
  acidBase(mod('lpenv', 4), mod('lpd', 0.15), mod('lps', 0), ...extra);

const fenv: Lesson = {
  id: 'm2-fenv',
  module: 2,
  title: 'The squelch',
  unlocks: [modBlockType('lpenv'), modBlockType('lpa'), modBlockType('lpd'), modBlockType('lps')],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-fenv-amount',
      label: 'Add the squelch',
      type: 'guided',
      say: [
        "Time for the secret ingredient. I've doubled the bass up to sixteen notes a cycle, the classic acid pace, with the filter nearly shut.",
        'The LFO moved the filter slowly, across many notes. Now we move it on every single note.',
        'A **filter envelope** is an envelope like attack and decay, but it shapes the filter cutoff instead of the volume. Each note kicks the cutoff up, then it falls back.',
        'Snap a **filter envelope** block under the bass and set it to 4: each note throws the filter open 4 octaves above the cutoff. Then listen.',
      ],
      start: acidBase(),
      check: { kind: 'control', control: 'lpenv', min: 2 },
      hints: [
        {
          say: 'It lives in the **Filter** drawer, and it sets how far each note sweeps the cutoff.',
        },
        {
          say: 'Snap a **filter envelope** block under the **filter type** and set it to 4.',
          highlight: { blockTypes: [modBlockType('lpenv')] },
        },
      ],
      solution: acidBase(mod('lpenv', 4)),
      success:
        'Squelch! **.lpenv** kicks the cutoff up on every note, and the resonance sings as it falls back. That rubbery sound is acid.',
    },
    {
      id: 'm2-fenv-snap',
      label: 'Make it snappy',
      type: 'puzzle',
      say: [
        'The filter envelope has its own ADSR: **filter attack**, **filter decay** and **filter sustain**.',
        "I've set mine slow and lazy: a long decay and a high sustain, so each note goes wah and stays open.",
        'Puzzle: make it tight and snappy. Bring **filter decay** and **filter sustain** down to 0.2 or less, and keep the envelope. 🎧 hear the goal has mine.',
      ],
      start: acidBase(mod('lpenv', 4), lazyDecay, lazySustain),
      check: {
        kind: 'all',
        checks: [
          { kind: 'control', control: 'lpenv', min: 2 },
          { kind: 'control', control: 'lpd', max: 0.2 },
          { kind: 'control', control: 'lps', max: 0.2 },
        ],
      },
      hints: [
        {
          say: 'Decay is how fast the filter closes after each kick; sustain is how far open it stays. Both want to be small.',
        },
        {
          say: 'Set **filter decay** to 0.15 and **filter sustain** to 0.',
          highlight: {
            blockTypes: [modBlockType('lpd'), modBlockType('lps')],
            nodeIds: [lazyDecay.id, lazySustain.id],
          },
        },
      ],
      solution: snappy(),
      target: snappy(),
      success:
        'Tight! Each note gets a quick bright blip and snaps shut. A short filter decay is the classic acid setting.',
    },
  ],
};

/* ---------- Effects ---------- */

const fx: Lesson = {
  id: 'm2-fx',
  module: 2,
  title: 'Space and grit',
  unlocks: [modBlockType('delay'), modBlockType('room'), modBlockType('distort')],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-fx-room',
      label: 'Add reverb',
      type: 'guided',
      say: [
        'Your acid line sounds like it lives in a tiny box. Effects give it a space to live in.',
        '**reverb** is the sound of a room: the walls throw back thousands of reflections that blur into a soft tail.',
        'Snap a **reverb** block under the bass. Try 0.3 for a touch of space, and go higher to drown it in reverb.',
      ],
      start: snappy(),
      check: { kind: 'control', control: 'room', min: 0.2 },
      hints: [
        { say: 'Effects live in the **Effects** drawer. Reverb is the room.' },
        {
          say: 'Snap a **reverb** block under the bass and set it to 0.3.',
          highlight: { blockTypes: [modBlockType('room')] },
        },
      ],
      solution: snappy(mod('room', 0.3)),
      success: 'Now it lives somewhere. **.room** sends part of the sound into a virtual room.',
    },
    {
      id: 'm2-fx-delay',
      label: 'Add echo',
      type: 'guided',
      say: [
        '**echo**, also called delay, is different. Instead of a blur you hear clean copies of each note, repeating behind it.',
        'Snap an **echo** block under the bass and set it to 0.3. Listen for the repeats bouncing between the notes.',
      ],
      check: { kind: 'control', control: 'delay', min: 0.2 },
      hints: [
        { say: 'Echo is in **Effects** too, right next to reverb.' },
        {
          say: 'Snap an **echo** block under the **reverb** and set it to 0.3.',
          highlight: { blockTypes: [modBlockType('delay')] },
        },
      ],
      solution: snappy(mod('room', 0.3), mod('delay', 0.3)),
      success:
        'Echoes! **.delay** mixes in delayed copies, and on a busy line like this they weave between the notes.',
    },
    {
      id: 'm2-fx-grit',
      label: 'Add grit',
      type: 'open',
      say: [
        'Last one: **grit**. Distortion pushes the wave so hard that its peaks get squashed flat, and that adds brand new overtones: crunch.',
        'Snap a **grit** block under the bass and try values from 0.5 up to 3. A little warms it up; a lot makes it snarl.',
        'It can get loud, so mind your ears. Tell me when it sounds right.',
      ],
      check: { kind: 'manual' },
      hints: [
        { say: 'Grit is the third block in **Effects**. Start small and creep up.' },
        {
          say: 'Snap a **grit** block under the bass and try 1.',
          highlight: { blockTypes: [modBlockType('distort')] },
        },
      ],
      solution: snappy(mod('room', 0.3), mod('delay', 0.3), mod('distort', 1)),
      success:
        'Crunchy. That is **.distort**. Space and grit: now your sound has a place and an attitude.',
    },
  ],
};

/* ---------- Capstone ---------- */

const acidLine = program(
  null,
  layer(
    notes(ACID),
    osc('sawtooth'),
    mod('lpf', signal('sine', 200, 1000, 8)),
    mod('lpq', 15),
    ftype('ladder'),
    mod('lpenv', 3),
  ),
);

const SAW = { s: 'sawtooth' };

const acidline: Lesson = {
  id: 'm2-acidline',
  module: 2,
  title: 'Capstone: an acid line',
  unlocks: [],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'm2-acidline-build',
      label: 'Build acid line',
      type: 'puzzle',
      say: [
        'Capstone time! Press 🎧 hear the goal: a proper acid line, the sound of a thousand warehouse raves.',
        'Rebuild it on a clean slate: sixteen sawtooth notes a cycle, a resonant filter with resonance past 10, and a cutoff that never sits still.',
        'Every acid line starts with a **filter cutoff**. Then move it however you like: a slow wave plugged into it, a **filter envelope**, or both, like mine. I used the ladder, too.',
        'You know every piece. One block at a time, and listen as you go.',
      ],
      start: program(null),
      check: {
        kind: 'all',
        checks: [
          { kind: 'onsetsPerCycle', where: SAW, count: 16 },
          { kind: 'control', control: 'lpf', where: SAW },
          { kind: 'control', control: 's', where: SAW, equals: 'sawtooth' },
          { kind: 'control', control: 'lpq', where: SAW, min: 10 },
          {
            kind: 'any',
            checks: [
              { kind: 'controlVaries', control: 'lpf', where: SAW, cycles: 4, minSpread: 500 },
              // The goal's own 8-cycle sweep only covers 600–1000 in the onset window.
              { kind: 'signalRange', control: 'lpf', minSpread: 500 },
              { kind: 'control', control: 'lpenv', where: SAW, min: 2 },
            ],
          },
        ],
      },
      hints: [
        {
          say: 'Start with an arm, **play notes**, a sawtooth and a **filter cutoff**: resonance and the filter envelope only work once there is a cutoff. For sixteen notes, **[c2 c2 c3 eb2]*4** plays a group of four, four times.',
        },
        {
          say: 'Under one **🐙 arm**: **play notes** with 16 notes, **with sound** sawtooth, **filter cutoff** with a wave plugged in, **resonance** at 15, **filter type** ladder and a **filter envelope** of 3.',
          highlight: {
            blockTypes: [
              BT.layer,
              BT.notes,
              BT.osc,
              modBlockType('lpf'),
              BT.signal,
              modBlockType('lpq'),
              BT.ftype,
              modBlockType('lpenv'),
            ],
          },
        },
      ],
      solution: acidLine,
      target: acidLine,
      success:
        'That is acid! Sixteen saw notes, a singing ladder filter and a cutoff that never sits still. Add a splash of echo or grit if you like. Module 2, done!',
    },
  ],
};

export const module2: Lesson[] = [waves, pitch, filter, envelope, movement, fenv, fx, acidline];
