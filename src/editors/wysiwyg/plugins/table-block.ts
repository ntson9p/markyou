import { tableBlockConfig, type RenderType } from '@milkdown/kit/component/table-block';
import type { Ctx } from '@milkdown/kit/ctx';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

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

/**
 * Drop stale insertion-line geometry when a table is resized.
 *
 * The component positions the row/column insertion lines by writing absolute
 * geometry into their inline styles on hover (`width` + `top` for the row
 * line, `left` + `height` for the column line) and only recomputes it on the
 * next hover. Those handles sit inside `.table-wrapper` — the table's scroll
 * container — and hiding them uses `visibility`, which keeps them in the box
 * tree. So after the page is resized (the page measure, the dual splitter, the
 * window), geometry measured against the old width overflows the new wrapper
 * and the table sprouts a phantom horizontal scrollbar — which then vanishes
 * as soon as a hover recomputes the handle.
 *
 * Hiding them with `display: none` would also keep them out of the overflow,
 * but it detaches `offsetParent`: floating-ui then resolves the handle against
 * the document and the affordance lands hundreds of pixels from its boundary.
 *
 * So clear the geometry instead, and only while a handle is hidden — a visible
 * one is being driven by the component and must not be touched. Nothing is
 * lost: the next pointer move measures the table afresh.
 */
export const tableHandleResetPlugin = $prose(
  () =>
    new Plugin({
      view: (view) => {
        if (typeof ResizeObserver === 'undefined') return {};

        const observed = new Set<Element>();
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const stale = entry.target.querySelectorAll<HTMLElement>(
              ':scope > .line-handle, :scope > .drag-preview',
            );
            for (const el of stale) {
              if (el.dataset.show !== 'true') el.removeAttribute('style');
            }
          }
        });

        const sync = () => {
          for (const wrapper of view.dom.querySelectorAll('.table-wrapper')) {
            if (!observed.has(wrapper)) {
              observer.observe(wrapper);
              observed.add(wrapper);
            }
          }
          for (const wrapper of observed) {
            if (!wrapper.isConnected) {
              observer.unobserve(wrapper);
              observed.delete(wrapper);
            }
          }
        };

        sync();
        return {
          update: sync,
          destroy: () => {
            observer.disconnect();
            observed.clear();
          },
        };
      },
    }),
);
