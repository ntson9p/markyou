import type { Heading } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { visit } from 'unist-util-visit';

import { parseMarkdown } from '@/core/markdown/parse';

export interface OutlineItem {
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** 1-based start line in the markdown body. */
  line: number;
}

/** Heading tree data source (FR-10.1) from the shared AST. */
export function extractOutline(body: string): OutlineItem[] {
  const tree = parseMarkdown(body);
  const items: OutlineItem[] = [];
  visit(tree, 'heading', (node: Heading) => {
    items.push({
      depth: node.depth,
      text: toString(node),
      line: node.position?.start.line ?? 1,
    });
  });
  return items;
}
