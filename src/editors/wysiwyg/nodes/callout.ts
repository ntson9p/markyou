import { $nodeSchema } from '@milkdown/kit/utils';

import { CALLOUT_TYPES, type CalloutType } from '@/core/markdown/callouts';

/**
 * Callout node (FR-5.10): `> [!NOTE] title` blockquotes as first-class styled
 * boxes. Parses from the `callout` mdast node produced by
 * `remarkCalloutNodes`; serializes back to a plain blockquote whose first
 * line is the marker, so the on-disk syntax stays GitHub/Obsidian compatible.
 *
 * The marker line is emitted as a custom `calloutMarker` phrasing node whose
 * stringify handler outputs the text verbatim — remark-stringify would
 * otherwise escape the leading `[` and break the syntax.
 */
export const calloutSchema = $nodeSchema('callout', () => ({
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: {
    calloutType: { default: 'note', validate: 'string' },
    title: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'div',
    {
      'data-type': 'callout',
      'data-callout-type': node.attrs.calloutType as string,
      'data-title': node.attrs.title as string,
      class: `callout callout-${node.attrs.calloutType as string}`,
    },
    0,
  ],
  parseDOM: [
    {
      tag: 'div[data-type="callout"]',
      getAttrs: (dom) => ({
        calloutType: (dom as HTMLElement).dataset.calloutType ?? 'note',
        title: (dom as HTMLElement).dataset.title ?? '',
      }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'callout',
    runner: (state, node, type) => {
      state.openNode(type, {
        calloutType: node.calloutType as CalloutType,
        title: (node.title as string) ?? '',
      });
      state.next(node.children);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'callout',
    runner: (state, node) => {
      const type = node.attrs.calloutType as string;
      const title = node.attrs.title as string;
      const marker = `[!${type.toUpperCase()}]${title ? ` ${title}` : ''}`;

      state.openNode('blockquote');
      const first = node.firstChild;
      if (first && first.type.name === 'paragraph' && first.childCount > 0) {
        // Canonical GitHub form: marker + soft break inside the first paragraph.
        state.openNode('paragraph');
        state.addNode('calloutMarker', undefined, `${marker}\n`);
        state.next(first.content);
        state.closeNode();
        for (let i = 1; i < node.childCount; i++) state.next(node.child(i));
      } else {
        // No leading paragraph (e.g. callout starting with a list): the
        // marker gets its own paragraph.
        state.openNode('paragraph');
        state.addNode('calloutMarker', undefined, marker);
        state.closeNode();
        for (let i = 0; i < node.childCount; i++) state.next(node.child(i));
      }
      state.closeNode();
    },
  },
}));

/**
 * remark-stringify handler for the synthetic `calloutMarker` node — verbatim
 * output, bypassing markdown escaping. Wired into `remarkStringifyOptionsCtx`
 * by the editor factory.
 */
export function calloutMarkerHandler(node: { value: string }): string {
  return node.value;
}

export { CALLOUT_TYPES };

export const calloutNodes = [calloutSchema].flat();
