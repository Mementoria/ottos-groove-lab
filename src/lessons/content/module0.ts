import { BT } from '../../blocks/blockTypes';
import { layer, program, sound } from '../../program/build';
import type { Lesson } from '../types';

const hello: Lesson = {
  id: 'm0-hello',
  module: 0,
  title: 'Hello, Otto',
  unlocks: [BT.layer, BT.sound],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm0-hello-arm',
      label: 'Grow an arm',
      type: 'guided',
      say: [
        "Hi, I'm Otto! I make music with my arms, and I could use a hand. Well, an arm.",
        'Each **🐙 arm** block is one of my arms. Drag one out of **Layers** into the workspace.',
        'Then snap a **play sound** block underneath it. Make sure its pattern has a **bd** in it.',
        '**bd** is short for bass drum: the kick, the thump at the bottom of most dance music.',
      ],
      check: { kind: 'hasSound', s: 'bd' },
      hints: [
        { say: 'An arm on its own is silent. It needs something hanging underneath it to play.' },
        {
          say: 'Grab a **🐙 arm** from Layers and a **play sound** block from Sounds, snap the sound under the arm, and type **bd**.',
          highlight: { blockTypes: [BT.layer, BT.sound] },
        },
      ],
      solution: program(null, layer(sound('bd'))),
      success:
        'There it is! In Strudel code that block is the **s** function, s for sound, with your pattern in quotes.',
    },
    {
      id: 'm0-hello-play',
      label: 'Press play',
      type: 'guided',
      say: [
        'Blocks are just sheet music until someone plays them. Hit ▶ and listen.',
        'Keep an eye on the wave next to me, too: every kick shows up as a big wobble.',
      ],
      check: { kind: 'playing' },
      hints: [
        {
          say: 'The round buttons under the wave, to my right, run the show. One of them is a little triangle.',
        },
        {
          say: "It's the ▶ play button just under the wave. Press it and turn your speakers up a bit.",
        },
      ],
      solution: program(null, layer(sound('bd'))),
      success:
        'Round and round it goes. That repeating loop is the heartbeat of everything we build.',
    },
    {
      id: 'm0-hello-sounds',
      label: 'Try sounds',
      type: 'open',
      say: [
        'Now swap sounds. Make the pattern just **bd**, then **sd**, then **hh**, then **cp**, and listen to each.',
        '**sd** is a snare, **hh** a hi-hat, **cp** a hand clap. You can change it while it plays.',
        "When you've heard them all, tell me it sounds right.",
      ],
      check: { kind: 'manual' },
      hints: [
        { say: 'Click the word in the play sound block and type a new sound name.' },
        {
          say: "It's the **play sound** block: click its pattern, type **hh**, then listen.",
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('hh'))),
      success: "Kick, snare, hats and clap: that's most of a drum kit already. Nice ears!",
    },
  ],
};

const cycle: Lesson = {
  id: 'm0-cycle',
  module: 0,
  title: 'The cycle',
  unlocks: [],
  codePane: 'collapsed',
  spectrum: false,
  steps: [
    {
      id: 'm0-cycle-two',
      label: 'Two sounds',
      type: 'guided',
      say: [
        "Here's a lone kick, **bd**. Listen: it repeats at a steady pace, like a loop on a tape.",
        'In Strudel that loop is called a **cycle**. Right now one kick fills the whole cycle.',
        'Type **bd sd** into the sound block: two sounds, one after the other.',
        'Then listen closely. Did the loop get longer, or did something else change?',
      ],
      start: program(null, layer(sound('bd'))),
      check: { kind: 'onsetsPerCycle', where: {}, count: 2 },
      hints: [
        { say: 'Sounds in one block play in a row. Put a space between their names.' },
        {
          say: 'In the **play sound** block, type **bd sd**.',
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('bd sd'))),
      success:
        'Same loop length, twice the hits! A cycle is a fixed slice of time, and everything in it shares the space.',
    },
    {
      id: 'm0-cycle-three',
      label: 'Fit three',
      type: 'puzzle',
      say: [
        'Puzzle time! Fit three sounds into one cycle. Any three you like.',
        'Guess first: will each hit come sooner or later than before? Then listen.',
        'Psst: press **peek at the code** to see the Strudel your blocks are writing.',
      ],
      check: { kind: 'onsetsPerCycle', where: {}, count: 3 },
      hints: [
        { say: 'Two sounds got half a cycle each. What happens when a third one joins the row?' },
        {
          say: 'Add a third name to your **play sound** block, like **bd sd hh**.',
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('bd sd hh'))),
      success: 'Three hits, a third of the cycle each. Hear how it rolls instead of marching?',
    },
    {
      id: 'm0-cycle-squeeze',
      label: 'Squeeze more',
      type: 'open',
      say: [
        "Here's the big idea: the cycle is the loop, and everything squeezes into it.",
        'Try four sounds, then five, then eight. The loop stays the same length; the hits just crowd closer.',
        'Play as long as you like, then tell me when it sounds right.',
      ],
      check: { kind: 'manual' },
      hints: [
        { say: 'Keep adding names with spaces between them, and listen to the gaps shrink.' },
        {
          say: "Try **bd hh sd hh** in the **play sound** block. That's a real little beat.",
          highlight: { blockTypes: [BT.sound] },
        },
      ],
      solution: program(null, layer(sound('bd hh sd hh'))),
      success:
        "That's the cycle! Every pattern you write lives inside one, and Strudel stretches or squeezes it to fit.",
    },
  ],
};

export const module0: Lesson[] = [hello, cycle];
