import { $nodeSchema } from '@milkdown/kit/utils';

/**
 * Block-level raw HTML chip (FR-5.11). The source is preserved verbatim in
 * the `value` attr and serializes back to a plain mdast `html` node — never
 * executed, never mangled (D13 rule 3). The mdast type `htmlBlock` is
 * produced by `remarkHtmlBlocks`; inline `html` stays on the preset schema.
 */
export const htmlBlockSchema = $nodeSchema('html_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'div',
    { 'data-type': 'html-block', 'data-value': node.attrs.value as string },
    node.attrs.value as string,
  ],
  parseDOM: [
    {
      tag: 'div[data-type="html-block"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'htmlBlock',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'html_block',
    runner: (state, node) => {
      state.addNode('html', undefined, node.attrs.value as string);
    },
  },
}));

export const htmlBlockNodes = [htmlBlockSchema].flat();
