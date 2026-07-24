import type { Root } from 'mdast';

import { parseMarkdown } from '@/core/markdown/parse';
import { resolveReferences } from '@/editors/wysiwyg/plugins/references';

/**
 * AST-equivalence comparator for the golden corpus (plan §3): two documents
 * are equivalent when their shared-grammar parses match after normalizations
 * that carry no content or rendering weight:
 *
 * - `position` info dropped;
 * - adjacent text siblings merged (serializers may split text nodes);
 * - reference links/images resolved to inline form on BOTH sides — the
 *   documented D13 normalization (definitions themselves are preserved and
 *   compared);
 * - reference/definition `label` dropped (the normalized `identifier` is the
 *   semantic key; label case is style).
 *
 * Everything else — text content, structure, ordering, list tightness, table
 * alignment, checked states, code/html/math values — must match exactly.
 */

interface AnyNode {
  type: string;
  children?: AnyNode[];
  value?: string;
  position?: unknown;
  data?: unknown;
  label?: unknown;
  [key: string]: unknown;
}

function normalizeNode(node: AnyNode): AnyNode {
  delete node.position;
  delete node.data;
  if ('label' in node) delete node.label;

  if (node.children) {
    node.children = node.children.map(normalizeNode);
    const merged: AnyNode[] = [];
    for (const child of node.children) {
      const prev = merged[merged.length - 1];
      if (prev && prev.type === 'text' && child.type === 'text') {
        prev.value = (prev.value ?? '') + (child.value ?? '');
      } else {
        merged.push(child);
      }
    }
    node.children = merged;
  }
  return node;
}

/** Parse with the shared grammar and normalize for comparison. */
export function normalizedAst(markdown: string): AnyNode {
  const tree = parseMarkdown(markdown) as Root;
  resolveReferences(tree);
  return normalizeNode(tree as unknown as AnyNode);
}
