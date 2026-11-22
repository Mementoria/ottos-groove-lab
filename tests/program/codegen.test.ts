import { describe, expect, it } from 'vitest';
import { gridToMini, toCheckExpression, toStrudelCode } from '../../src/program/codegen';
import {
  bank,
  grid,
  layer,
  mod,
  muted,
  notes,
  osc,
  program,
  signal,
  sound,
} from '../../src/program/build';

function stepsOn(...hits: number[]): boolean[] {
  return Array.from({ length: 16 }, (_, i) => hits.includes(i));
}

function sampleProgram() {
  const kick = layer(grid('bd', [0, 4, 8, 12]), bank('RolandTR909'));
  const bassOsc = osc('sawtooth');
  const filter = mod('lpf', signal('sine', 200, 2000, 4));
  const bassSource = notes('c2 c2 eb2 c3');
  const bass = layer(bassSource, bassOsc, filter);
  return { kick, bass, filter, bassSource, prog: program(130, kick, bass) };
}

describe('gridToMini', () => {
  it('groups steps into beats of four', () => {
    expect(gridToMini('bd', stepsOn(0, 4, 8, 12))).toBe(
      '[bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~]',
    );
  });

  it('renders a beat with no hits as a single rest', () => {
    expect(gridToMini('bd', stepsOn(0))).toBe('[bd ~ ~ ~] ~ ~ ~');
  });
});

describe('toStrudelCode', () => {
  it('generates the full program', () => {
    const { prog } = sampleProgram();
    expect(toStrudelCode(prog).code).toBe(
      [
        'setcpm(130/4)',
        '',
        '$: s("[bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~]")',
        '  .bank("RolandTR909")',
        '',
        '$: note("c2 c2 eb2 c3")',
        '  .s("sawtooth")',
        '  .lpf(sine.range(200, 2000).slow(4))',
        '',
      ].join('\n'),
    );
  });

  it('prefixes muted layers with _$:', () => {
    const { code } = toStrudelCode(program(null, muted(layer(sound('hh*8')))));
    expect(code).toBe('_$: s("hh*8")\n');
  });

  it('omits setcpm and the leading blank line when bpm is null', () => {
    const { code } = toStrudelCode(program(null, layer(sound('bd'))));
    expect(code).toBe('$: s("bd")\n');
  });

  it('reports exact spans for modifiers and sources', () => {
    const { bassSource, filter, prog } = sampleProgram();
    const { code, spans } = toStrudelCode(prog);
    const modSpan = spans[filter.id] ?? [0, 0];
    const sourceSpan = spans[bassSource.id] ?? [0, 0];
    expect(code.slice(modSpan[0], modSpan[1])).toBe('.lpf(sine.range(200, 2000).slow(4))');
    expect(code.slice(sourceSpan[0], sourceSpan[1])).toBe('note("c2 c2 eb2 c3")');
  });

  it('escapes strings with JSON.stringify', () => {
    const { code } = toStrudelCode(program(null, layer(sound('a "b"'))));
    expect(code).toBe('$: s("a \\"b\\"")\n');
  });

  it('formats numbers without a trailing decimal for integers', () => {
    const { code } = toStrudelCode(
      program(null, layer(sound('bd'), mod('gain', 0.8), mod('lpf', 800))),
    );
    expect(code).toContain('.gain(0.8)');
    expect(code).toContain('.lpf(800)');
  });

  it('omits layers whose sound or notes mini is whitespace-only', () => {
    const { code } = toStrudelCode(
      program(null, layer(sound('  ')), layer(notes('')), layer(sound('bd'))),
    );
    expect(code).toBe('$: s("bd")\n');
  });

  it('keeps a grid layer with no hits', () => {
    const { code } = toStrudelCode(program(null, layer(grid('bd', []))));
    expect(code).toBe('$: s("~ ~ ~ ~")\n');
  });

  it('generates an empty string for an empty program', () => {
    expect(toStrudelCode(program(null)).code).toBe('');
  });
});

describe('toCheckExpression', () => {
  it('stacks the layers on one line', () => {
    const { prog } = sampleProgram();
    expect(toCheckExpression(prog)).toBe(
      'stack(s("[bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~] [bd ~ ~ ~]").bank("RolandTR909"), note("c2 c2 eb2 c3").s("sawtooth").lpf(sine.range(200, 2000).slow(4)))',
    );
  });

  it('excludes muted layers', () => {
    const expr = toCheckExpression(program(null, muted(layer(sound('hh'))), layer(sound('bd'))));
    expect(expr).toBe('stack(s("bd"))');
  });

  it('is silence for an empty program', () => {
    expect(toCheckExpression(program(null))).toBe('silence');
  });

  it('omits layers with whitespace-only minis', () => {
    expect(toCheckExpression(program(null, layer(sound('   '))))).toBe('silence');
  });
});
