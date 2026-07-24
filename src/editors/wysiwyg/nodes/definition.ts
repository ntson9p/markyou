import { $nodeSchema } from '@milkdown/kit/utils';

/**
 * Link definition chip: preserves `[label]: url "title"` lines verbatim in
 * position (see plugins/references.ts). Serializes back to a standard mdast
 * `definition` node, which remark-stringify emits natively.
 */
export const definitionSchema = $nodeSchema('definition_block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  attrs: {
    identifier: { default: '', validate: 'string' },
    label: { default: '', validate: 'string' },
    url: { default: '', validate: 'string' },
    title: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'div',
    {
      'data-type': 'definition',
      'data-identifier': node.attrs.identifier as string,
      class: 'definition-chip',
    },
    `[${(node.attrs.label as string) || (node.attrs.identifier as string)}]: ${node.attrs.url as string}`,
  ],
  parseDOM: [
    {
      tag: 'div[data-type="definition"]',
      getAttrs: (dom) => ({
        identifier: (dom as HTMLElement).dataset.identifier ?? '',
      }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'definitionBlock',
    runner: (state, node, type) => {
      state.addNode(type, {
        identifier: (node.identifier as string) ?? '',
        label: (node.label as string) ?? '',
        url: (node.url as string) ?? '',
        title: (node.title as string) ?? '',
      });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'definition_block',
    runner: (state, node) => {
      state.addNode('definition', undefined, undefined, {
        identifier: node.attrs.identifier as string,
        label: (node.attrs.label as string) || (node.attrs.identifier as string),
        url: node.attrs.url as string,
        title: (node.attrs.title as string) || null,
      });
    },
  },
}));

export const definitionNodes = [definitionSchema].flat();
