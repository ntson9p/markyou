import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';

import { renderTex } from '@/lib/katex';

import { mathBlockSchema, mathInlineSchema } from '../nodes/math';
import { openSourcePopover } from './source-popover';

/**
 * Math NodeViews (FR-5.8): KaTeX-rendered atoms; click opens the source
 * popover with live preview; invalid LaTeX shows a graceful error chip.
 */

function openMathEditor(
  view: EditorView,
  getPos: () => number | undefined,
  dom: HTMLElement,
  displayMode: boolean,
) {
  const pos = getPos();
  if (pos === undefined) return;
  const current = view.state.doc.nodeAt(pos);
  if (!current) return;

  openSourcePopover({
    anchor: dom,
    value: current.attrs.value as string,
    label: displayMode ? 'Edit block math (LaTeX)' : 'Edit inline math (LaTeX)',
    placeholder: displayMode ? '\\int_0^1 x\\,dx' : 'e^{i\\pi}+1=0',
    onPreview: (value, previewEl) => {
      void renderTex(previewEl, value || '\\text{(empty)}', displayMode);
    },
    onApply: (value) => {
      const at = getPos();
      if (at === undefined) return;
      const node = view.state.doc.nodeAt(at);
      if (!node) return;
      view.dispatch(view.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, value }));
      view.focus();
    },
  });
}

function renderMathInto(el: HTMLElement, value: string, displayMode: boolean) {
  if (!value) {
    el.innerHTML = '';
    const placeholder = document.createElement('span');
    placeholder.className = 'math-placeholder';
    placeholder.textContent = displayMode ? 'Empty math block — click to edit' : 'ƒ(x)';
    el.appendChild(placeholder);
    return;
  }
  void renderTex(el, value, displayMode);
}

function mathViewFactory(displayMode: boolean): NodeViewConstructor {
  return (node, view, getPos) => {
    const dom: HTMLElement = document.createElement(displayMode ? 'div' : 'span');
    dom.className = displayMode ? 'math-block-node' : 'math-inline-node';
    dom.dataset.type = displayMode ? 'math-block' : 'math-inline';
    dom.setAttribute('role', 'button');
    dom.setAttribute('tabindex', '0');
    dom.setAttribute(
      'aria-label',
      displayMode ? 'Block math, click to edit' : 'Inline math, click to edit',
    );

    let value = node.attrs.value as string;
    renderMathInto(dom, value, displayMode);

    const open = () => openMathEditor(view, getPos, dom, displayMode);
    dom.addEventListener('click', open);
    dom.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });

    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) return false;
        const next = updated.attrs.value as string;
        if (next !== value) {
          value = next;
          renderMathInto(dom, value, displayMode);
        }
        return true;
      },
      ignoreMutation: () => true,
    };
  };
}

export const mathInlineView = $view(mathInlineSchema.node, () => mathViewFactory(false));
export const mathBlockView = $view(mathBlockSchema.node, () => mathViewFactory(true));

export const mathViews = [mathInlineView, mathBlockView];
