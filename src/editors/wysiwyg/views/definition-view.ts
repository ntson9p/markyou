import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';

import { definitionSchema } from '../nodes/definition';

/**
 * Link definition chip: read-only display of a preserved `[label]: url`
 * line (see plugins/references.ts). Selectable and deletable like any atom.
 */
export const definitionView = $view(definitionSchema.node, (): NodeViewConstructor => {
  return (node) => {
    const dom = document.createElement('div');
    dom.className = 'definition-chip';
    dom.dataset.type = 'definition';
    dom.setAttribute('aria-label', 'Link definition');

    const render = (current: typeof node) => {
      const label = (current.attrs.label as string) || (current.attrs.identifier as string);
      const url = current.attrs.url as string;
      const title = current.attrs.title as string;
      dom.textContent = `[${label}]: ${url}${title ? ` "${title}"` : ''}`;
    };
    render(node);

    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) return false;
        render(updated);
        return true;
      },
      ignoreMutation: () => true,
    };
  };
});
