import { BT, modBlockType } from '../../blocks/blockTypes';
import { bank, ftype, grid, layer, mod, notes, osc, program, signal } from '../../program/build';
import type { Layer, Modifier, Program } from '../../program/types';
import type { Lesson } from '../types';

const BPM = 128;
const BEATS = [0, 4, 8, 12];
const BACKBEAT = [4, 12];
const OFFBEATS = [2, 6, 10, 14];

/** Sixteen notes a cycle, circling one low C: drops to c1, g1 and bb1, a lift to eb2. */
const LINE = '[c2 c2 c1 c2] [eb2 c2 c1 g1] [c2 c2 c1 bb1] [c2 eb2 g1 c2]';

/** The layer filters: every bass check looks only at the saw, every kick check at the 909 kick. */
const SAW = { s: 'sawtooth' };
const KICK = { s: 'bd', bank: 'RolandTR909' };

const kick = (): Layer => layer(grid('bd', BEATS), bank('RolandTR909'), mod('gain', 1));
const bass = (...extra: Modifier[]): Layer => layer(notes(LINE), osc('sawtooth'), ...extra);
/**
 * The squelch. The sine spans 200–1400 over 8 cycles, so the first 4 cycles (the check window)
 * cover 800–1400: a 600 Hz spread. Ladder only, no high-pass: under ladder, hpf is a low-pass too.
 */
const squelchy = (...extra: Modifier[]): Layer =>
  bass(
    mod('lpf', signal('sine', 200, 1400, 8)),
    mod('lpq', 16),
    ftype('ladder'),
    mod('lpenv', 3.5),
    ...extra,
  );
const hats = (): Layer => layer(grid('oh', OFFBEATS), bank('RolandTR909'), mod('gain', 0.6));
const claps = (): Layer => layer(grid('cp', BACKBEAT), bank('RolandTR909'));

const kickOnly = (): Program => program(BPM, kick());
const withBass = (): Program => program(BPM, kick(), bass());
const withSquelch = (): Program => program(BPM, kick(), squelchy());
const withDrums = (): Program => program(BPM, kick(), squelchy(), hats(), claps());
const fullSong = (): Program =>
  program(BPM, kick(), squelchy(mod('distort', 0.4), mod('delay', 0.3)), hats(), claps());

const acid: Lesson = {
  id: 'song-acid',
  module: 'acid',
  title: 'Acid',
  unlocks: [],
  codePane: 'readonly',
  spectrum: true,
  steps: [
    {
      id: 'acid-kick',
      label: 'Kick at 128',
      type: 'puzzle',
      say: [
        "Welcome to the Song Studio! This is where it all comes together: we're building a whole acid track, one arm at a time.",
        'Acid was born in Chicago in the mid-1980s, out of a little Roland box called the **TB-303 Bass Line**. It was sold as a bass player for guitarists to practise with. It flopped, turned up cheap second-hand, and a few house producers found out it could squelch.',
        'Every acid track stands on a steady kick. Press 🎧 hear the goal: a TR-909 kick on every beat, four-on-the-floor, at 128 BPM.',
        'Start from a clean slate: a **tempo** block, and an arm with a **drum** grid of **bd** and a **drum machine** set to TR-909. I turned mine up to full with a **volume** of 1, because in this music the kick is the boss.',
      ],
      start: program(null),
      check: {
        kind: 'all',
        checks: [
          { kind: 'tempo', bpm: BPM, tolerance: 2 },
          { kind: 'onsetsAt', where: KICK, steps: BEATS },
        ],
      },
      hints: [
        {
          say: 'Three things to set: the speed of the whole song, a kick on every beat, and the machine the kick comes from.',
        },
        {
          say: 'Set a **tempo** block to 128. Then, under a **🐙 arm**, a **drum** grid with **bd** on squares 1, 5, 9 and 13, and a **drum machine** set to **TR-909**.',
          highlight: { blockTypes: [BT.tempo, BT.layer, BT.grid, BT.bank] },
        },
      ],
      solution: kickOnly(),
      target: kickOnly(),
      success:
        'Thump, thump, thump, thump: 128 kicks a minute, the heartbeat the rest of the track hangs on. In code that is **setcpm(128/4)** and a **$:** line with **.bank("RolandTR909")** on it.',
    },
    {
      id: 'acid-bass',
      label: 'Saw bassline',
      type: 'puzzle',
      say: [
        'Now the star of the show. A 303 line is sixteen short notes a cycle, four to every beat, low down in the bass. The real 303 only has two waves, sawtooth and square, and sawtooth is the classic.',
        'Press 🎧 hear the goal. My line sits on a low C and keeps circling it: down an octave to **c1**, up to **eb2**, and down to **g1** and **bb1**.',
        "Grow a second arm with **play notes** and a sawtooth, and write sixteen notes using at least three different ones. Borrow mine or write your own. It's allowed to buzz for now: the filter comes next.",
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'layers', min: 2 },
          { kind: 'onsetsPerCycle', where: SAW, count: 16 },
          { kind: 'distinctNotes', min: 3 },
        ],
      },
      hints: [
        {
          say: 'Sixteen notes is four groups of four. Brackets help you count: **[c2 c2 c1 c2]** is one beat of notes.',
        },
        {
          say: 'Add a **🐙 arm** with **play notes** and **with sound** set to **sawtooth**, and type **[c2 c2 c1 c2] [eb2 c2 c1 g1] [c2 c2 c1 bb1] [c2 eb2 g1 c2]**.',
          highlight: { blockTypes: [BT.layer, BT.notes, BT.osc] },
        },
      ],
      solution: withBass(),
      target: withBass(),
      success:
        "That's a 303-style line: busy, low and a little relentless. Notice how it loops without really going anywhere? That's the point. Acid is hypnotic: one short pattern, round and round, while the sound itself changes.",
    },
    {
      id: 'acid-squelch',
      label: 'Make it squelch',
      type: 'puzzle',
      say: [
        "Here's the secret of acid: the notes were never the point. The 303's **filter** was. Producers left one pattern running and twisted its knobs for minutes on end. Phuture's **Acid Tracks**, the 1987 record that gave acid its name, is mostly exactly that.",
        'Three moves make the squelch. Turn the **resonance** way up so the filter sings. Add a **filter envelope** that kicks the cutoff open on every note. And let the cutoff itself wander slowly up and down.',
        'Press 🎧 hear the goal and switch to **Spectrum**: watch a sharp peak jump on each note, and drift as the sweep moves.',
        'On your bass: a **filter cutoff** with a slow **sine wave** plugged in (mine goes from 200 to 1400 over 8 cycles), **resonance** past 10, **filter type** ladder, and a **filter envelope** of 2 or more.',
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'control', control: 'lpf', where: SAW },
          { kind: 'control', control: 'ftype', where: SAW, equals: 'ladder' },
          { kind: 'control', control: 'lpq', where: SAW, min: 10 },
          { kind: 'control', control: 'lpenv', where: SAW, min: 2 },
          { kind: 'controlVaries', control: 'lpf', where: SAW, cycles: 4, minSpread: 500 },
        ],
      },
      hints: [
        {
          say: 'Start with a **filter cutoff**: resonance and the envelope only work once there is one. Then give the sweep room to move, at least 500 Hz between its lowest and highest.',
        },
        {
          say: 'Under the bass: **filter cutoff** with a **sine wave** from 200 to 1400 over 8 cycles, **resonance** 16, **filter type** ladder, and **filter envelope** 3.5.',
          highlight: {
            blockTypes: [
              modBlockType('lpf'),
              BT.signal,
              modBlockType('lpq'),
              BT.ftype,
              modBlockType('lpenv'),
            ],
          },
        },
      ],
      solution: withSquelch(),
      target: withSquelch(),
      success:
        'Squelch! That rubbery, almost talking sound is acid. Resonance makes the filter sing, the envelope kicks it on every note, and the slow sine keeps it wandering, so the same sixteen notes never sound quite the same twice.',
    },
    {
      id: 'acid-hats',
      label: 'Hats and clap',
      type: 'puzzle',
      say: [
        "The bass squelches. Now give it a groove to ride. Acid grew out of Chicago house, and it borrows house's drums: open hats on the offbeats and a clap on 2 and 4.",
        'Press 🎧 hear the goal. That is two more arms: open hats (**oh**) on squares 3, 7, 11 and 15, and claps (**cp**) on 5 and 13.',
        "I ran both through the 909 too, and turned the hats' **volume** down to 0.6 so they don't shout over the bass.",
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'onsetsAt', where: { s: 'oh' }, steps: OFFBEATS },
          { kind: 'onsetsAt', where: { s: 'cp' }, steps: BACKBEAT },
        ],
      },
      hints: [
        {
          say: 'Each sound gets its own arm. The hats sit halfway between the kicks; the claps land on beats 2 and 4.',
        },
        {
          say: 'Add two **🐙 arm** blocks with **drum** grids: **oh** on squares 3, 7, 11 and 15, and **cp** on 5 and 13. Give each a **drum machine** set to **TR-909**.',
          highlight: { blockTypes: [BT.layer, BT.grid, BT.bank] },
        },
      ],
      solution: withDrums(),
      target: withDrums(),
      success:
        "Now it moves! Kick, clap and open hats, the same skeleton as your Module 1 house groove, with a 303 squelching on top. That's acid house.",
    },
    {
      id: 'acid-grit',
      label: 'Grit and echo',
      type: 'puzzle',
      say: [
        'Last touch: attitude. Acid producers love pushing the 303 into distortion to make it snarl, and adding echo so the notes smear into each other.',
        'Press 🎧 hear the goal. On the bass arm, add **grit** of at least 0.2 and **echo** of at least 0.2.',
        'Go gently with grit. A resonant filter already has loud peaks, and distortion makes them louder fast. I used 0.4.',
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'control', control: 'distort', where: SAW, min: 0.2 },
          { kind: 'control', control: 'delay', where: SAW, min: 0.2 },
        ],
      },
      hints: [
        { say: 'Both live in **Effects**, and both go on the bass arm, not the drums.' },
        {
          say: 'Under the bass, snap a **grit** block set to 0.4 and an **echo** block set to 0.3.',
          highlight: { blockTypes: [modBlockType('distort'), modBlockType('delay')] },
        },
      ],
      solution: fullSong(),
      target: fullSong(),
      success:
        'Grit and echo: the line snarls, and its repeats fill the gaps between the notes. That is a full acid track, and you built every arm of it.',
    },
    {
      id: 'acid-yours',
      label: 'Make it yours',
      type: 'open',
      say: [
        "It's your track now. Acid is played as much as it's written: leave it running and ride the knobs while you listen.",
        "Try **resonance** at 20 for a wilder squelch, a wider sweep on the **sine wave**, or a **filter envelope** of 5. Swap the saw for **square**, the 303's other wave. Mute an arm, then bring it back in.",
        'A real 303 also has **accent** and **slide** switches that make single notes jump out or glide into the next. Listen for them in acid tracks.',
        'When it sounds right to you, tell me.',
      ],
      check: { kind: 'manual' },
      hints: [
        { say: 'Small moves are fine. Change one thing, listen, then keep it or put it back.' },
        {
          say: 'Turn **resonance** up to 20, or set the top of the **sine wave** to 2000, and listen to the squelch change.',
          highlight: { blockTypes: [modBlockType('lpq'), BT.signal] },
        },
      ],
      solution: fullSong(),
      success:
        'That is your acid track! Press **Copy code** to take the Strudel code with you, or **Open in strudel.cc** to play it in Strudel itself. Next time you watch a Strudel acid video, you will know what every line does.',
    },
  ],
};

export const acidSong: Lesson[] = [acid];
