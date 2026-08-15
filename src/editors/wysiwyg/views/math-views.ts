import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { $prose, $view } from '@milkdown/kit/utils';
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

/**
 * Tag a transaction with `setMeta(openMathBlockEditorKey, pos)` to pop the
 * LaTeX editor for the math block it creates at `pos`. Used by the `$$ `
 * input rule so typing it goes straight to writing math instead of leaving an
 * empty stub the user has to go back and click.
 */
export const openMathBlockEditorKey = new PluginKey<number | null>('openMathBlockEditor');

const mathAutoOpenPlugin = $prose(
  () =>
    new Plugin<number | null>({
      key: openMathBlockEditorKey,
      state: {
        init: () => null,
        // The request has to survive until a view update actually runs: other
        // plugins append transactions to the same dispatch, and only the final
        // state reaches the view hook. So it stays pending (position-mapped)
        // until the hook below clears it explicitly.
        apply: (tr, pending) => {
          const requested = tr.getMeta(openMathBlockEditorKey) as number | null | undefined;
          if (requested !== undefined) return requested;
          return pending == null ? null : tr.mapping.map(pending);
        },
      },
      view: () => ({
        update: (view) => {
          const pos = openMathBlockEditorKey.getState(view.state);
          if (pos == null) return;
          const dom = view.nodeDOM(pos);
          // Clear before opening — the popover focuses its own textarea, and a
          // later dispatch would pull focus straight back to the document.
          view.dispatch(view.state.tr.setMeta(openMathBlockEditorKey, null));
          if (dom instanceof HTMLElement) openMathEditor(view, () => pos, dom, true);
        },
      }),
    }),
);

export const mathViews = [mathInlineView, mathBlockView, mathAutoOpenPlugin];
