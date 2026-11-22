import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Strudel-flavoured colours for the code pane's light (#fffdf8) background, echoing the block
 * category colours where they map, each darkened to at least 4.5:1 contrast.
 */
export const codeHighlightStyle = HighlightStyle.define([
  // `$:` / `_$:`: one per layer, like the arm hats.
  { tag: tags.labelName, color: '#7446c4', fontWeight: '600' },
  // Mini-notation strings: the patterns themselves.
  { tag: tags.string, color: '#b5306a' },
  { tag: tags.number, color: '#a35200' },
  // s(…), note(…), setcpm(…)
  { tag: tags.function(tags.variableName), color: '#2f62b8' },
  // .bank(…), .lpf(…), .range(…)
  { tag: [tags.function(tags.propertyName), tags.propertyName], color: '#0f766e' },
  // Signals such as sine, saw.
  { tag: tags.variableName, color: '#3a7a3a' },
  { tag: tags.keyword, color: '#7446c4' },
  { tag: tags.comment, color: '#6f675a', fontStyle: 'italic' },
]);

export const codeHighlighting = syntaxHighlighting(codeHighlightStyle);
