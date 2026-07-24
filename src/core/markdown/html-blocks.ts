import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * mdast uses the single type `html` for both block-level and inline raw HTML —
 * the position in the tree is the only difference. The WYSIWYG schema needs
 * two distinct node types (block chip vs inline chip, FR-5.11), so this
 * parse-time transform re-tags block-position `html` nodes as `htmlBlock`.
 *
 * Serialization emits plain `html` nodes again, so this type never leaks out.
 */

/** Parents whose children are phrasing content — `html` inside these is inline. */
const PHRASING_PARENTS = new Set([
  'paragraph',
  'heading',
  'emphasis',
  'strong',
  'delete',
  'link',
  'linkReference',
  'tableCell',
]);

export interface HtmlBlockMdast {
  type: 'htmlBlock';
  value: string;
}

export function remarkHtmlBlocks() {
  return (tree: Root) => {
    visit(tree, 'html', (node, _index, parent) => {
      if (parent && !PHRASING_PARENTS.has(parent.type)) {
        (node as unknown as HtmlBlockMdast).type = 'htmlBlock';
      }
    });
  };
}
