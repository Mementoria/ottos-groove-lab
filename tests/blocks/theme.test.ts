import { oglTheme } from '../../src/blocks/theme';

function channel(hex: string, at: number): number {
  const c = parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('oglTheme', () => {
  it('gives toolbox labels an explicit colour with WCAG AA contrast on the toolbox', () => {
    const { toolboxForegroundColour, toolboxBackgroundColour } = oglTheme().componentStyles;
    expect(toolboxForegroundColour).toMatch(/^#[0-9a-f]{6}$/i);
    expect(toolboxBackgroundColour).toMatch(/^#[0-9a-f]{6}$/i);
    expect(
      contrast(toolboxForegroundColour ?? '', toolboxBackgroundColour ?? ''),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
