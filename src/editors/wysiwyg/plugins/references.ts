import { $remark } from '@milkdown/kit/utils';
import type { Definition, Image, ImageReference, Link, LinkReference, Root } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Reference-style links (D13): Milkdown ships `remark-inline-links`, which
 * inlines references but silently DROPS definitions — including unused ones.
 * That violates the no-content-loss rule, so we replace it:
 *
 * - used `linkReference`/`imageReference` nodes are resolved to inline
 *   `link`/`image` nodes (documented style normalization — rendering is
 *   identical);
 * - `definition` nodes are preserved as `definitionBlock` chips that
 *   serialize back to standard mdast `definition` nodes in place.
 */

export interface DefinitionBlockMdast {
  type: 'definitionBlock';
  identifier: string;
  label?: string;
  url: string;
  title?: string | null;
}

/**
 * Resolve reference links/images to inline form (mutates the tree). Exported
 * separately so the round-trip corpus comparator can apply the same
 * normalization to both sides.
 */
export function resolveReferences(tree: Root): void {
  const defs = new Map<string, Definition>();
  visit(tree, 'definition', (node: Definition) => {
    if (!defs.has(node.identifier)) defs.set(node.identifier, node);
  });

  visit(tree, (node, index, parent) => {
    if (!parent || index === undefined) return;
    if (node.type === 'linkReference') {
      const ref = node as LinkReference;
      const def = defs.get(ref.identifier);
      if (!def) return;
      const link: Link = {
        type: 'link',
        url: def.url,
        title: def.title ?? null,
        children: ref.children,
      };
      parent.children[index] = link;
    } else if (node.type === 'imageReference') {
      const ref = node as ImageReference;
      const def = defs.get(ref.identifier);
      if (!def) return;
      const image: Image = {
        type: 'image',
        url: def.url,
        title: def.title ?? null,
        alt: ref.alt ?? '',
      };
      parent.children[index] = image;
    }
  });
}

export function remarkReferences() {
  return (tree: Root) => {
    resolveReferences(tree);
    visit(tree, 'definition', (node: Definition) => {
      (node as unknown as DefinitionBlockMdast).type = 'definitionBlock';
    });
  };
}

export const remarkReferencesPlugin = $remark('remarkReferences', () => remarkReferences);
