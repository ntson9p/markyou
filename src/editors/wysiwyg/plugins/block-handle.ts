import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { block, blockConfig, BlockProvider, defaultNodeFilter } from '@milkdown/kit/plugin/block';
import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import { findParent } from '@milkdown/kit/prose';
import { dropCursor } from '@milkdown/kit/prose/dropcursor';
import { TextSelection } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

import { icons } from './icons';

/**
 * Drag handles + insert-below affordance (FR-5.6): a hover grip per top-level
 * block for drag-reordering, plus a `+` button that inserts a fresh paragraph
 * beneath. Drag/drop mechanics come from the block plugin; the drop indicator
 * is ProseMirror's drop cursor.
 */

/** Containers whose children are dragged as a unit, not individually. */
const CONTAINER_NODES = new Set(['table', 'blockquote', 'callout', 'math_block', 'diagram']);

class BlockHandleView {
  readonly #ctx: Ctx;
  readonly #content: HTMLElement;
  readonly #provider: BlockProvider;

  constructor(ctx: Ctx) {
    this.#ctx = ctx;
    const content = document.createElement('div');
    content.className = 'milkdown-block-handle';
    this.#content = content;

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'block-handle-op block-handle-add';
    add.setAttribute('aria-label', 'Insert block below');
    add.title = 'Insert block below';
    add.innerHTML = icons.plus;
    // Prevent the click from initiating a block drag (content is draggable).
    add.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    add.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#onAdd();
    });

    const grip = document.createElement('div');
    grip.className = 'block-handle-op block-handle-grip';
    grip.setAttribute('aria-label', 'Drag to move');
    grip.title = 'Drag to move';
    grip.innerHTML = icons.grip;

    content.append(add, grip);

    this.#provider = new BlockProvider({
      ctx,
      content,
      getOffset: () => 8,
      getPlacement: ({ active }) => (active.node.type.name === 'heading' ? 'left' : 'left-start'),
    });
    this.#provider.update();
  }

  #onAdd() {
    const view = this.#ctx.get(editorViewCtx);
    if (!view.hasFocus()) view.focus();
    const active = this.#provider.active;
    if (!active) return;
    const { state, dispatch } = view;
    const pos = active.$pos.pos + active.node.nodeSize;
    let tr = state.tr.insert(pos, paragraphSchema.type(this.#ctx).create());
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
    dispatch(tr.scrollIntoView());
    this.#provider.hide();
  }

  update() {
    this.#provider.update();
  }

  destroy() {
    this.#provider.destroy();
    this.#content.remove();
  }
}

/** ProseMirror drop cursor — the visible drop indicator during a drag. */
export const blockDropCursor = $prose(() =>
  dropCursor({ class: 'milkdown-drop-cursor', width: 2, color: 'var(--primary)' }),
);

export function configureBlockHandle(ctx: Ctx) {
  ctx.set(blockConfig.key, {
    filterNodes: (pos, node) => {
      if (findParent((n) => CONTAINER_NODES.has(n.type.name))(pos)) return false;
      return defaultNodeFilter(pos, node);
    },
  });
  ctx.set(block.key, {
    view: () => new BlockHandleView(ctx),
  });
}
