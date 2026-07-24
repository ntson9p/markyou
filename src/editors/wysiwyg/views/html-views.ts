import { htmlSchema } from '@milkdown/kit/preset/commonmark';
import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';

import { htmlBlockSchema } from '../nodes/html-block';
import { openSourcePopover } from './source-popover';

/**
 * Raw HTML chips (FR-5.11): inert, clearly marked, source editable via
 * popover. The source is shown as TEXT — never parsed or executed.
 */

function attachEditing(
  dom: HTMLElement,
  view: EditorView,
  getPos: () => number | undefined,
  label: string,
  multiline: boolean,
) {
  const open = () => {
    const pos = getPos();
    if (pos === undefined) return;
    const current = view.state.doc.nodeAt(pos);
    if (!current) return;
    openSourcePopover({
      anchor: dom,
      value: current.attrs.value as string,
      label,
      multiline,
      onApply: (next) => {
        const at = getPos();
        if (at === undefined) return;
        const target = view.state.doc.nodeAt(at);
        if (!target) return;
        view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...target.attrs, value: next }));
        view.focus();
      },
    });
  };
  dom.addEventListener('click', open);
  dom.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
}

export const htmlInlineView = $view(htmlSchema.node, (): NodeViewConstructor => {
  return (node, view, getPos) => {
    const dom = document.createElement('span');
    dom.className = 'html-chip html-chip-inline';
    dom.dataset.type = 'html-inline';
    dom.setAttribute('role', 'button');
    dom.setAttribute('tabindex', '0');
    dom.setAttribute('aria-label', 'Inline HTML, click to edit source');

    let value = node.attrs.value as string;
    dom.textContent = value;
    attachEditing(dom, view, getPos, 'Edit inline HTML', false);

    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) return false;
        const next = updated.attrs.value as string;
        if (next !== value) {
          value = next;
          dom.textContent = value;
        }
        return true;
      },
      ignoreMutation: () => true,
    };
  };
});

export const htmlBlockView = $view(htmlBlockSchema.node, (): NodeViewConstructor => {
  return (node, view, getPos) => {
    const dom = document.createElement('div');
    dom.className = 'html-chip html-chip-block';
    dom.dataset.type = 'html-block';
    dom.setAttribute('role', 'button');
    dom.setAttribute('tabindex', '0');
    dom.setAttribute('aria-label', 'HTML block, click to edit source');

    const badge = document.createElement('span');
    badge.className = 'html-chip-badge';
    badge.textContent = 'HTML';

    const source = document.createElement('pre');
    source.className = 'html-chip-source';

    dom.append(badge, source);

    let value = node.attrs.value as string;
    source.textContent = value;
    attachEditing(dom, view, getPos, 'Edit HTML block', true);

    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) return false;
        const next = updated.attrs.value as string;
        if (next !== value) {
          value = next;
          source.textContent = value;
        }
        return true;
      },
      ignoreMutation: () => true,
    };
  };
});

export const htmlViews = [htmlInlineView, htmlBlockView];
