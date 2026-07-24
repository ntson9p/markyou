import { $remark } from '@milkdown/kit/utils';
import type { Code, Root } from 'mdast';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';

import { remarkCalloutNodes } from '@/core/markdown/callouts';
import { remarkHtmlBlocks } from '@/core/markdown/html-blocks';

/**
 * The WYSIWYG parse path extensions, mirroring the shared grammar
 * (`core/markdown/parse.ts`): math + callouts. GFM comes from Milkdown's
 * preset-gfm (same remark-gfm underneath); frontmatter never reaches the
 * WYSIWYG editor (split at the store boundary, FR-5.12).
 */
export const remarkMathPlugin = $remark('remarkMath', () => remarkMath);

/** Blockquote callouts → first-class `callout` mdast nodes (FR-5.10). */
export const remarkCalloutPlugin = $remark('remarkCalloutNodes', () => remarkCalloutNodes);

/** Block-position raw HTML → `htmlBlock` mdast nodes for the chip schema (FR-5.11). */
export const remarkHtmlBlockPlugin = $remark('remarkHtmlBlocks', () => remarkHtmlBlocks);

/**
 * ```mermaid fences → `diagram` mdast nodes (FR-5.9). Re-tagging at parse
 * time keeps the diagram schema's matcher disjoint from the generic code
 * block regardless of schema registration order.
 */
export function remarkDiagrams() {
  return (tree: Root) => {
    visit(tree, 'code', (node: Code) => {
      if (node.lang === 'mermaid') {
        (node as unknown as { type: string }).type = 'diagram';
      }
    });
  };
}

export const remarkDiagramPlugin = $remark('remarkDiagrams', () => remarkDiagrams);

export const wysiwygRemarkPlugins = [
  remarkMathPlugin,
  remarkCalloutPlugin,
  remarkHtmlBlockPlugin,
  remarkDiagramPlugin,
].flat();
