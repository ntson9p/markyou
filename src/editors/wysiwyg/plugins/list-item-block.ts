import { listItemBlockConfig } from '@milkdown/kit/component/list-item-block';
import type { Ctx } from '@milkdown/kit/ctx';

/**
 * Marker glyphs for the list-item component (FR-4.4: the preview is the
 * styling reference).
 *
 * The component draws its own markers — native ones are hidden — and asks this
 * config for each glyph. Its default for a bullet is `⦿` (U+29BF CIRCLED
 * BULLET), a dot inside a ring that reads as a selected radio button rather
 * than a list bullet, and matches nothing the preview draws for the same
 * markdown. `•` is the text equivalent of the preview's `list-style: disc`.
 *
 * Ordered labels and task checkboxes keep the component's own glyphs.
 */
export function configureListItemBlock(ctx: Ctx) {
  ctx.set(listItemBlockConfig.key, {
    renderLabel: ({ label, listType, checked }) => {
      if (checked != null) return checked ? '☑' : '□';
      return listType === 'bullet' ? '•' : label;
    },
  });
}
