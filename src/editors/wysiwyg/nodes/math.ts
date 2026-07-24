import { $nodeSchema } from '@milkdown/kit/utils';

/**
 * Math nodes (FR-5.8). mdast types come from the shared remark-math plugin:
 * `inlineMath` for `$…$`, `math` for `$$…$$`. Both are atoms whose LaTeX
 * source lives in the `value` attr; NodeViews render KaTeX and open the
 * source popover editor.
 */

export const mathInlineSchema = $nodeSchema('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'span',
    { 'data-type': 'math-inline', 'data-value': node.attrs.value as string },
    node.attrs.value as string,
  ],
  parseDOM: [
    {
      tag: 'span[data-type="math-inline"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.value as string);
    },
  },
}));

export const mathBlockSchema = $nodeSchema('math_block', () => ({
  group: 'block',
  atom: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  toDOM: (node) => [
    'div',
    { 'data-type': 'math-block', 'data-value': node.attrs.value as string },
    node.attrs.value as string,
  ],
  parseDOM: [
    {
      tag: 'div[data-type="math-block"]',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, type) => {
      state.addNode(type, { value: node.value as string });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => {
      state.addNode('math', undefined, node.attrs.value as string);
    },
  },
}));

export const mathNodes = [mathInlineSchema, mathBlockSchema].flat();
