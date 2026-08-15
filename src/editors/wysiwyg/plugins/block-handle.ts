import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { block, blockConfig, BlockProvider, defaultNodeFilter } from '@milkdown/kit/plugin/block';
import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import { findParent } from '@milkdown/kit/prose';
import { dropCursor } from '@milkdown/kit/prose/dropcursor';
import { TextSelection, type EditorState } from '@milkdown/kit/prose/state';
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

/**
 * Position immediately after the top-level block starting at `offset`.
 *
 * The block provider captures its active block on hover and doesn't refresh it
 * as the document changes, so the node it hands back is often an older, shorter
 * version of itself — hover an empty code block, type into it, and its recorded
 * `nodeSize` still says empty. Measuring from that splices content into the
 * middle of the real node and splits it in two, so the size is re-read from the
 * current document and only the offset is taken on trust; a null return means
 * even that no longer points at a block.
 */
function insertPosAfter(state: EditorState, offset: number): number | null {
  if (offset < 0 || offset > state.doc.content.size) return null;
  const $at = state.doc.resolve(offset);
  if ($at.depth !== 0) return null;
  const current = state.doc.nodeAt(offset);
  return current ? offset + current.nodeSize : null;
}

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
    // Keep the press away from both the block drag (content is draggable) and
    // ProseMirror itself. The mouse events matter as much as the pointer ones:
    // ProseMirror opens its selection machinery on mousedown and *settles it on
    // mouseup*, i.e. after #onAdd has already run, which would drag the caret
    // back into whatever block sits under the cursor.
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    add.addEventListener('pointerdown', swallow);
    add.addEventListener('mousedown', swallow);
    add.addEventListener('mouseup', swallow);
    add.addEventListener('pointerup', (e) => {
      swallow(e);
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
    const active = this.#provider.active;
    if (!active) return;
    const { state, dispatch } = view;
    const pos = insertPosAfter(state, active.$pos.pos);
    if (pos === null) {
      this.#provider.hide();
      return;
    }
    let tr = state.tr.insert(pos, paragraphSchema.type(this.#ctx).create());
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
    dispatch(tr.scrollIntoView());
    // Focus *after* dispatching: focusing first re-syncs the old selection to
    // the DOM, and for a NodeView-backed block (code block, table) that hands
    // DOM focus back to the node's own editor, so the caret never reaches the
    // paragraph we just inserted.
    view.focus();
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
