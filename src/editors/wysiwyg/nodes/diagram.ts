import { $nodeSchema } from '@milkdown/kit/utils';

/**
 * Mermaid diagram node (FR-5.9): a ```mermaid fence rendered read-only with
 * click-to-edit source popover. The `diagram` mdast type is produced by the
 * `remarkDiagrams` re-tagging transform, keeping this matcher disjoint from
 * the generic code block schema.
 */
export const diagramSchema = $nodeSchema('diagram', () => ({
  group: 'block',
  atom: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'div',
    { 'data-type': 'diagram', 'data-value': node.attrs.value as string },
    node.attrs.value as string,
  ],
  parseDOM: [
    {
      tag: 'div[data-type="diagram"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'diagram',
    runner: (state, node, type) => {
      state.addNode(type, { value: (node.value as string) ?? '' });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'diagram',
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.value as string, { lang: 'mermaid' });
    },
  },
}));

export const diagramNodes = [diagramSchema].flat();
