import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';

import { CALLOUT_TYPES, calloutTitle, type CalloutType } from '@/core/markdown/callouts';

import { calloutSchema } from '../nodes/callout';

/**
 * Callout NodeView (FR-5.10): the same `.callout` structure the preview
 * renders (shared typography theme), plus an inline type picker. Body content
 * is editable in place via contentDOM.
 */
export const calloutView = $view(calloutSchema.node, (): NodeViewConstructor => {
  return (node, view, getPos) => {
    const dom = document.createElement('div');
    dom.dataset.type = 'callout';

    const titleRow = document.createElement('div');
    titleRow.className = 'callout-title';
    titleRow.contentEditable = 'false';

    const titleText = document.createElement('span');
    titleText.className = 'callout-title-text';

    const picker = document.createElement('select');
    picker.className = 'callout-picker';
    picker.setAttribute('aria-label', 'Callout type');
    for (const type of CALLOUT_TYPES) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      picker.appendChild(option);
    }
    picker.addEventListener('change', () => {
      const pos = getPos();
      if (pos === undefined) return;
      view.dispatch(
        view.state.tr.setNodeMarkup(pos, undefined, {
          ...view.state.doc.nodeAt(pos)?.attrs,
          calloutType: picker.value,
        }),
      );
    });

    titleRow.append(titleText, picker);

    const contentDOM = document.createElement('div');
    contentDOM.className = 'callout-content';

    dom.append(titleRow, contentDOM);

    const sync = (current: typeof node) => {
      const type = current.attrs.calloutType as CalloutType;
      const title = current.attrs.title as string;
      dom.className = `callout callout-${type}`;
      titleText.textContent = calloutTitle({ type, title });
      picker.value = type;
    };
    sync(node);

    return {
      dom,
      contentDOM,
      update: (updated) => {
        if (updated.type !== node.type) return false;
        sync(updated);
        return true;
      },
      ignoreMutation: (mutation) => titleRow.contains(mutation.target),
    };
  };
});
