import type { Blockquote, Paragraph, Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * Callouts (FR-5.10, §6 flavor table): GitHub/Obsidian style
 * `> [!NOTE] optional title` blockquotes. This module is the single source of
 * truth for callout syntax — the preview transform and the WYSIWYG node (M3)
 * both use `parseCalloutMarker`.
 */

export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

const MARKER_RE = /^\[!(\w+)\][ \t]*([^\n]*)(?:\n|$)/;

export interface CalloutMarker {
  type: CalloutType;
  title: string;
  /** Characters consumed from the start of the first text node. */
  consumed: number;
}

/** Detect a callout marker at the start of a blockquote's first paragraph text. */
export function parseCalloutMarker(firstText: string): CalloutMarker | null {
  const m = MARKER_RE.exec(firstText);
  if (!m) return null;
  const type = m[1].toLowerCase();
  if (!(CALLOUT_TYPES as readonly string[]).includes(type)) return null;
  return { type: type as CalloutType, title: m[2].trim(), consumed: m[0].length };
}

/** Default display title for a callout type. */
export function calloutTitle(marker: Pick<CalloutMarker, 'type' | 'title'>): string {
  return marker.title || marker.type.charAt(0).toUpperCase() + marker.type.slice(1);
}

/** Inspect a blockquote mdast node; returns the marker if it is a callout. */
export function blockquoteCalloutMarker(node: Blockquote): CalloutMarker | null {
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return null;
  const firstChild = first.children[0];
  if (!firstChild || firstChild.type !== 'text') return null;
  return parseCalloutMarker(firstChild.value);
}

/**
 * remark transform for the preview pipeline: blockquote callouts become
 * `<div class="callout callout-<type>">` with a styled title row.
 */
export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const marker = blockquoteCalloutMarker(node);
      if (!marker) return;

      const firstParagraph = node.children[0] as Paragraph;
      const firstText = firstParagraph.children[0] as Text;

      // Strip the marker from the content.
      const remainder = firstText.value.slice(marker.consumed).replace(/^\n/, '');
      if (remainder) {
        firstText.value = remainder;
      } else {
        firstParagraph.children.shift();
        // A marker-only line may leave a leading break node behind.
        if (firstParagraph.children[0]?.type === 'break') firstParagraph.children.shift();
        if (firstParagraph.children.length === 0) node.children.shift();
      }

      const title: Paragraph = {
        type: 'paragraph',
        data: {
          hName: 'div',
          hProperties: { className: ['callout-title'] },
        },
        children: [{ type: 'text', value: calloutTitle(marker) }],
      };
      node.children.unshift(title);

      node.data = {
        ...node.data,
        hName: 'div',
        hProperties: {
          className: ['callout', `callout-${marker.type}`],
        },
      };
    });
  };
}
