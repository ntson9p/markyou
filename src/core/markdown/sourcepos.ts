import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'table',
  'pre',
  'blockquote',
  'div',
  'hr',
  'section',
]);

/**
 * Stamp `data-sourcepos="<startLine>"` on block-level elements (plan §2.3) so
 * scroll sync can map source lines ↔ preview positions precisely instead of
 * proportionally. Runs after sanitize (positions survive; the attribute is
 * added by us, not by document content).
 */
export function rehypeSourcepos() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const line = node.position?.start?.line;
      if (line !== undefined && BLOCK_TAGS.has(node.tagName)) {
        node.properties = { ...node.properties, dataSourcepos: String(line) };
      }
    });
  };
}
