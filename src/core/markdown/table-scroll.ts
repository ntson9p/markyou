import type { Element, Root } from 'hast';
import { SKIP, visit } from 'unist-util-visit';

/** Class name of the per-table scroll container (styled in typography.css). */
export const TABLE_SCROLL_CLASS = 'md-table-scroll';

/**
 * Wrap every `<table>` in `<div class="md-table-scroll">`.
 *
 * `.md-doc table` is a real table box so that `width: 100%` is honoured and a
 * table tracks the width of its column. A table box ignores `overflow`,
 * though, so a table too wide for its container needs a block container of its
 * own to scroll inside — without one it spills and scrolls the whole document
 * sideways. (The WYSIWYG editor doesn't need this plugin: Milkdown's table
 * NodeView already renders its own `.table-wrapper` scroll container.)
 *
 * Runs after `rehypeSourcepos`, which matters twice: the `data-sourcepos`
 * stamp stays on the table itself (scroll-sync anchors read positions via
 * `getBoundingClientRect`, so the extra nesting is invisible to them), and the
 * wrapper never receives a stamp of its own — a `div` on the same source line
 * would duplicate the anchor.
 */
export function rehypeTableScroll() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return;
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: [TABLE_SCROLL_CLASS] },
        children: [node],
      };
      parent.children[index] = wrapper;
      // Don't descend into the table we just moved, and resume *after* the
      // wrapper — revisiting it would wrap the same table again, forever.
      return [SKIP, index + 1] as [typeof SKIP, number];
    });
  };
}
