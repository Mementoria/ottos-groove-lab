import { BT, modBlockType } from '../../blocks/blockIds';
import { bank, grid, layer, mod, program, sound } from '../../program/build';
import type { Layer } from '../../program/types';
import type { Lesson } from '../types';

const BEATS = [0, 4, 8, 12];
const BACKBEAT = [4, 12];
const OFFBEATS = [2, 6, 10, 14];

const kick = (): Layer => layer(grid('bd', BEATS));
const snare = (): Layer => layer(grid('sd', BACKBEAT));
const offbeatHats = (): Layer => layer(grid('hh', OFFBEATS));
const fastHats = (): Layer => layer(sound('hh*4'), mod('fast', 2));

const steps: Lesson = {
  id: 'm1-steps',
  module: 1,
  title: 'Steps and rests',
  unlocks: [BT.grid],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm1-steps-rests',
      label: 'Add rests',
      type: 'guided',
      say: [
        'Music needs silence as much as sound. A slot where nothing plays is called a rest.',
        "In Strudel a rest is **~**, a tilde. I've loaded **bd ~ sd ~**: four slots, two of them silent. Have a listen.",
        'Now make it twice as busy, same shape: **bd ~ sd ~ bd ~ sd ~**.',
      ],
      start: program(null, layer(sound('bd ~ sd ~'))),
      check: {
        kind: 'all',
        checks: [
          { kind: 'onsetsAt', where: { s: 'bd' }, steps: [0, 8] },
          { kind: 'onsetsAt', where: { s: 'sd' }, steps: [4, 12] },
        ],
      },
      hints: [
        {
          say: 'Rests count as slots too. Eight slots, rests included, all squeeze into one cycle.',
        },
        {
          say: 'In the **play sound** block, type the pattern twice in a row: **bd ~ sd ~ bd ~ sd ~**.',
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('bd ~ sd ~ bd ~ sd ~'))),
      success:
        'Kick, snare, kick, snare, with air in between: the backbone of rock, pop and hip-hop. Each **~** held its slot in silence.',
    },
    {
      id: 'm1-steps-four',
      label: 'Four on floor',
      type: 'puzzle',
      say: [
        'Typing tildes gets fiddly, so meet the **drum** grid: 16 squares make one cycle, like a step sequencer.',
        "I've put a kick on the first square. Click the grid to open it, and add a kick on every beat: squares 1, 5, 9 and 13.",
        "A kick on every beat is called four-on-the-floor. It's the engine of house and techno.",
        'Peek at the code afterwards: the empty squares turn into **~** rests.',
      ],
      start: program(null, layer(grid('bd', [0]))),
      check: { kind: 'onsetsAt', where: { s: 'bd' }, steps: BEATS },
      hints: [
        {
          say: 'Four beats in a cycle, sixteen squares: so a new beat starts every fourth square.',
        },
        {
          say: 'Click the **drum** grid to open it, then light squares 5, 9 and 13 alongside the first one.',
          highlight: { blockTypes: [BT.grid] },
        },
      ],
      solution: program(null, kick()),
      success:
        'Four-on-the-floor! In code each beat is **[bd ~ ~ ~]**: one kick, then three silent sixteenths.',
    },
  ],
};

const subdiv: Lesson = {
  id: 'm1-subdiv',
  module: 1,
  title: 'Faster and smaller',
  unlocks: [],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm1-subdiv-eight',
      label: 'Eight hats',
      type: 'guided',
      say: [
        'Here are four hi-hats, one per beat. Listen to them tick along.',
        'Want eight? You could type **hh** eight times, or write **hh*8**. The star means "repeat this, squeezed into its slot".',
        'Try **hh*8** and listen: twice as many hats, still one cycle.',
      ],
      start: program(null, layer(sound('hh hh hh hh'))),
      check: { kind: 'onsetsPerCycle', where: { s: 'hh' }, count: 8 },
      hints: [
        { say: 'The star multiplies: **hh*2** plays two hats in the space of one.' },
        {
          say: 'Replace the pattern in the **play sound** block with **hh*8**.',
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('hh*8'))),
      success:
        'Eighth-note hats! **hh*8** packs eight hits into one slot, and here that slot is the whole cycle.',
    },
    {
      id: 'm1-subdiv-group',
      label: 'Double hit',
      type: 'puzzle',
      say: [
        'Back to four hats. Now a new trick: square brackets **[ ]** squeeze a group into one slot.',
        '**[hh hh]** plays two quick hats in the time of one.',
        'Puzzle: keep the four beats, but turn beat 2 into a quick double hit.',
      ],
      start: program(null, layer(sound('hh hh hh hh'))),
      check: { kind: 'onsetsAt', where: { s: 'hh' }, steps: [0, 4, 6, 8, 12] },
      hints: [
        { say: 'Beat 2 is the second word in the pattern. What if that word were a whole group?' },
        {
          say: 'In the **play sound** block, change the second **hh** into **[hh hh]**.',
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('hh [hh hh] hh hh'))),
      success:
        'Hear the little skip? That is subdivision: one beat split in two. Brackets nest, too, so you can go as small as you like.',
    },
  ],
};

const layers: Lesson = {
  id: 'm1-layers',
  module: 1,
  title: 'Layers (more arms!)',
  unlocks: [],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm1-layers-two',
      label: 'Kick and snare',
      type: 'puzzle',
      say: [
        "So far I've been playing with one arm. I've got seven more!",
        'Each **🐙 arm** is a layer: its own part, playing at the same time as the others. In code, each arm is a **$:** line.',
        'Here is your four-on-the-floor kick. Grow a second arm and put a snare on beats 2 and 4.',
        'Snare on 2 and 4 is the backbeat: where everyone claps along.',
      ],
      start: program(null, kick()),
      check: {
        kind: 'all',
        checks: [
          { kind: 'layers', min: 2 },
          { kind: 'onsetsAt', where: { s: 'bd' }, steps: BEATS },
          { kind: 'onsetsAt', where: { s: 'sd' }, steps: BACKBEAT },
        ],
      },
      hints: [
        { say: 'One arm plays one sound. The snare needs an arm of its own.' },
        {
          say: 'Drag a new **🐙 arm** and hang a **drum** grid under it. Type **sd** for its sound, then click the grid and light only squares 5 and 13.',
          highlight: { blockTypes: [BT.layer, BT.grid] },
        },
      ],
      solution: program(null, kick(), snare()),
      success:
        'Two arms, one groove! Kick and snare each get their own layer, and Strudel plays them together.',
    },
    {
      id: 'm1-layers-hats',
      label: 'Offbeat hats',
      type: 'puzzle',
      say: [
        "Time for a third arm. Let's put hi-hats on the offbeats, right between the kicks.",
        'Count along: 1-and-2-and-3-and-4-and. The kicks land on the numbers; the hats go on every "and".',
        "On the grid that's squares 3, 7, 11 and 15. You'll know that tss, tss, tss from a thousand house tracks.",
      ],
      check: {
        kind: 'all',
        checks: [
          { kind: 'layers', min: 3 },
          { kind: 'onsetsAt', where: { s: 'hh' }, steps: OFFBEATS },
        ],
      },
      hints: [
        {
          say: 'An offbeat sits halfway between two beats. On the grid, each beat is four squares wide.',
        },
        {
          say: 'Add a third **🐙 arm** with a **drum** grid set to **hh**, and light only squares 3, 7, 11 and 15.',
          highlight: { blockTypes: [BT.layer, BT.grid] },
        },
      ],
      solution: program(null, kick(), snare(), offbeatHats()),
      success: 'Boots and cats! Kick, snare and offbeat hats on three arms: a proper house groove.',
    },
  ],
};

const tempo: Lesson = {
  id: 'm1-tempo',
  module: 1,
  title: 'Tempo',
  unlocks: [BT.tempo, modBlockType('fast'), modBlockType('slow')],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm1-tempo-120',
      label: 'Set 120 BPM',
      type: 'guided',
      say: [
        "Same groove, but I've slowed it down. Listen: lazy, almost hip-hop.",
        'Speed is measured in BPM, beats per minute. The **tempo** block at the top says 90 right now.',
        'Bring it up to 120 BPM, a classic house speed, and hear the groove wake up.',
        'In code that becomes **setcpm(120/4)**: Strudel counts cycles per minute, and each of our cycles holds four beats.',
      ],
      start: program(90, kick(), snare(), offbeatHats()),
      check: { kind: 'tempo', bpm: 120, tolerance: 0 },
      hints: [
        { say: 'Look for the block that says BPM. Its number is the speed of the whole song.' },
        {
          say: 'Click the number in the **tempo** block and type 120.',
          highlight: { blockTypes: [BT.tempo] },
        },
      ],
      solution: program(120, kick(), snare(), offbeatHats()),
      success:
        "120 BPM: two beats every second. Fun fact: that's the speed you've been hearing all along, Strudel's default.",
    },
    {
      id: 'm1-tempo-fast',
      label: 'Double the hats',
      type: 'puzzle',
      say: [
        'I swapped your hats for **hh*4**: four hats, one on each beat.',
        "Meet the **faster** block. It speeds up one arm's pattern and leaves the tempo alone.",
        'Puzzle: double the hats with a **faster** block, without touching **hh*4**.',
        'Its twin, **slower**, stretches a pattern out instead. Try both and listen!',
      ],
      start: program(120, kick(), snare(), layer(sound('hh*4'))),
      check: { kind: 'onsetsPerCycle', where: { s: 'hh' }, count: 8 },
      hints: [
        { say: 'The tempo block speeds up every arm. You only want the hats to hurry.' },
        {
          say: "From **Time**, snap a **faster** block under the hats' **play sound** block and set it to 2.",
          highlight: { blockTypes: [modBlockType('fast')] },
        },
      ],
      solution: program(120, kick(), snare(), fastHats()),
      success:
        '**.fast(2)** doubled the hats and left the kick and snare alone. Tempo moves everything; fast and slow move one arm.',
    },
  ],
};

const capstoneGroove = program(
  124,
  layer(grid('bd', BEATS), bank('RolandTR909')),
  layer(grid('cp', BACKBEAT), bank('RolandTR909')),
  layer(grid('oh', OFFBEATS), bank('RolandTR909'), mod('gain', 0.6)),
);

const machines: Lesson = {
  id: 'm1-machines',
  module: 1,
  title: 'Drum machines',
  unlocks: [BT.bank, modBlockType('gain')],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm1-machines-909',
      label: 'Pick a 909',
      type: 'guided',
      say: [
        'Dance music runs on a few famous drum machines, each with its own character.',
        'The Roland TR-909 kick is behind a huge slice of house and techno. Let me lend it to you.',
        'Snap a **drum machine** block under your kick and pick **TR-909**. In code it reads **.bank("RolandTR909")**.',
      ],
      check: { kind: 'control', control: 'bank', where: { s: 'bd' }, equals: 'RolandTR909' },
      hints: [
        { say: 'The machine is chosen per arm. Which arm holds your kick?' },
        {
          say: "From **Sounds**, snap a **drum machine** block under the kick's **drum** grid and pick **TR-909**.",
          highlight: { blockTypes: [BT.bank] },
        },
      ],
      solution: program(120, layer(grid('bd', BEATS), bank('RolandTR909')), snare(), fastHats()),
      success:
        'Hear the punch? Same **bd** pattern, new machine: **bank** swaps where the samples come from.',
    },
    {
      id: 'm1-machines-groove',
      label: 'Rebuild the groove',
      type: 'puzzle',
      say: [
        'Capstone time! Press 🎧 hear the goal to hear a groove of mine, then rebuild it on a clean slate.',
        "It's a 909 kick on every beat, claps (**cp**) on 2 and 4, and open hats (**oh**) on the offbeats, at 124 BPM.",
        'I ran all three through the 909, and used a **volume** block to tuck the loud open hats back a little.',
        'You know every piece already. One arm at a time, and listen as you go.',
      ],
      start: program(null),
      check: {
        kind: 'all',
        checks: [
          { kind: 'tempo', bpm: 124, tolerance: 0 },
          { kind: 'onsetsAt', where: { s: 'bd' }, steps: BEATS },
          { kind: 'control', control: 'bank', where: { s: 'bd' }, equals: 'RolandTR909' },
          { kind: 'onsetsAt', where: { s: 'cp' }, steps: BACKBEAT },
          { kind: 'onsetsAt', where: { s: 'oh' }, steps: OFFBEATS },
        ],
      },
      hints: [
        {
          say: 'Start with the kick, then the claps, then the hats. Set the tempo last, and compare with the goal.',
        },
        {
          say: 'You need three **🐙 arm** blocks with **drum** grids (**bd**, **cp**, **oh**), a **drum machine** on the kick, and a **tempo** block at 124.',
          highlight: { blockTypes: [BT.layer, BT.grid, BT.bank, BT.tempo] },
        },
      ],
      solution: capstoneGroove,
      target: capstoneGroove,
      success:
        'That is a real house groove, and you built it: steps, rests, layers, tempo and a classic drum machine. Module 1, done!',
    },
  ],
};

export const module1: Lesson[] = [steps, subdiv, layers, tempo, machines];
