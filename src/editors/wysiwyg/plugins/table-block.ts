import { tableBlockConfig, type RenderType } from '@milkdown/kit/component/table-block';
import type { Ctx } from '@milkdown/kit/ctx';

import { icons } from './icons';

/**
 * Chrome for the table NodeView (FR-5.7): drag handles, column alignment,
 * add/remove row and column.
 *
 * The component asks its config to render each control and falls back to bare
 * text placeholders — `=` for the drag handles, `left`/`center`/`right` for
 * alignment, `+`/`-` for add/remove. Those leak into the document as stray
 * characters, so map every control to the same lucide glyphs the rest of the
 * editor chrome uses.
 *
 * The component owns the `<button>` element, so the accessible name has to
 * travel with the icon: each control carries a visually-hidden label
 * (`.milkdown-sr-only`) that names it for screen readers (§a11y button-name).
 */

const CONTROLS: Record<RenderType, { icon: string; label: string }> = {
  add_row: { icon: icons.plus, label: 'Add row' },
  add_col: { icon: icons.plus, label: 'Add column' },
  delete_row: { icon: icons.trash, label: 'Delete row' },
  delete_col: { icon: icons.trash, label: 'Delete column' },
  align_col_left: { icon: icons.alignLeft, label: 'Align column left' },
  align_col_center: { icon: icons.alignCenter, label: 'Align column center' },
  align_col_right: { icon: icons.alignRight, label: 'Align column right' },
  col_drag_handle: { icon: icons.gripHorizontal, label: 'Select or drag column' },
  row_drag_handle: { icon: icons.grip, label: 'Select or drag row' },
};

export function configureTableBlock(ctx: Ctx) {
  ctx.set(tableBlockConfig.key, {
    renderButton: (renderType) => {
      const { icon, label } = CONTROLS[renderType];
      return `${icon}<span class="milkdown-sr-only">${label}</span>`;
    },
  });
}
