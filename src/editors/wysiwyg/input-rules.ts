import { InputRule } from '@milkdown/kit/prose/inputrules';
import { $inputRule } from '@milkdown/kit/utils';

import { CALLOUT_TYPES, type CalloutType } from '@/core/markdown/callouts';

import { calloutSchema } from './nodes/callout';
import { mathBlockSchema, mathInlineSchema } from './nodes/math';
import { openMathBlockEditorKey } from './views/math-views';

/**
 * Markdown autoformat rules beyond the presets (FR-5.3): `$math$`, `$$` math
 * blocks, and `[!type]` callout conversion inside blockquotes.
 */

/** Typing `$e^x$` converts to an inline math node (closing `$` triggers). */
export const mathInlineInputRule = $inputRule((ctx) => {
  return new InputRule(/(?<!\$)\$([^$\s](?:[^$\n]*[^$\s])?)\$$/, (state, match, start, end) => {
    const $start = state.doc.resolve(start);
    if (!$start.parent.type.allowsMarkType(state.schema.marks.inlineCode)) {
      // inside code-ish context; leave it alone
      return null;
    }
    const value = match[1];
    const type = mathInlineSchema.type(ctx);
    return state.tr.replaceRangeWith(start, end, type.create({ value }));
  });
});

/**
 * Typing `$$` then space on an empty line creates a math block and opens its
 * LaTeX editor.
 *
 * The paragraph is swapped for the math block in a single step: deleting the
 * `$$` first and *then* replacing the paragraph range would apply stale,
 * pre-delete positions to the shortened document and throw ("Position N out of
 * range"), which aborted the whole input and left `$$` sitting there as text.
 */
export const mathBlockInputRule = $inputRule((ctx) => {
  return new InputRule(/^\$\$\s$/, (state, _match, start) => {
    const $start = state.doc.resolve(start);
    const paragraph = $start.parent;
    if (paragraph.type.name !== 'paragraph') return null;
    // Only when `$$` is the paragraph's whole content — replacing the block
    // would otherwise swallow whatever sits after the caret.
    if ($start.parentOffset !== 0 || paragraph.content.size !== 2) return null;

    const from = $start.before();
    const type = mathBlockSchema.type(ctx);
    return state.tr
      .replaceRangeWith(from, $start.after(), type.create({ value: '' }))
      .setMeta(openMathBlockEditorKey, from);
  });
});

/** Typing `[!note] ` at the start of a blockquote paragraph converts it to a callout. */
export const calloutInputRule = $inputRule((ctx) => {
  const pattern = new RegExp(`^\\[!(${CALLOUT_TYPES.join('|')})\\][ \\t]*([^\\n]*)\\s$`, 'i');
  return new InputRule(pattern, (state, match, start, end) => {
    const $start = state.doc.resolve(start);
    if ($start.parent.type.name !== 'paragraph') return null;
    if ($start.depth < 2) return null;
    const parent = $start.node(-1);
    if (parent.type.name !== 'blockquote') return null;

    const calloutType = match[1].toLowerCase() as CalloutType;
    const title = (match[2] ?? '').trim();
    const blockquotePos = $start.before(-1);

    return state.tr
      .setNodeMarkup(blockquotePos, calloutSchema.type(ctx), { calloutType, title })
      .delete(start, end);
  });
});

export const wysiwygInputRules = [mathInlineInputRule, mathBlockInputRule, calloutInputRule];
