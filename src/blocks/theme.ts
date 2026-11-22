import * as Blockly from 'blockly';

export type Category =
  'Layers' | 'Sounds' | 'Notes' | 'Filter' | 'Envelope' | 'Movement' | 'Effects' | 'Time';

/** Palette order. */
export const CATEGORIES: readonly Category[] = [
  'Layers',
  'Sounds',
  'Notes',
  'Filter',
  'Envelope',
  'Movement',
  'Effects',
  'Time',
];

/** One distinct colour per category; every block takes its category's colour. */
export const CATEGORY_COLOURS: Record<Category, string> = {
  Layers: '#8a5cd6',
  Sounds: '#e0457b',
  Notes: '#3b7ddd',
  Filter: '#139a8f',
  Envelope: '#d98a0b',
  Movement: '#3fa34d',
  Effects: '#e5622e',
  Time: '#607089',
};

const THEME_NAME = 'ottos-groove-lab';

let theme: Blockly.Theme | null = null;

/** The Zelos-based workspace theme; created on first use so importing this module has no side effects. */
export function oglTheme(): Blockly.Theme {
  theme ??= Blockly.Theme.defineTheme(THEME_NAME, {
    name: THEME_NAME,
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: '#f7f4ee',
      toolboxBackgroundColour: '#ffffff',
      // Explicit, so labels never inherit a page colour (#2b2b2b on white is about 14:1).
      toolboxForegroundColour: '#2b2b2b',
      flyoutBackgroundColour: '#efeae0',
      flyoutOpacity: 1,
      scrollbarColour: '#c9c1b3',
      insertionMarkerColour: '#000000',
      insertionMarkerOpacity: 0.25,
    },
    fontStyle: { family: 'system-ui, -apple-system, "Segoe UI", sans-serif', size: 12 },
    startHats: false,
  });
  return theme;
}
