import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';

import { renderMermaidToSvg } from '@/editors/preview/mermaid';
import { openDiagramEditor } from '@/features/diagram/store';

import { diagramSchema } from '../nodes/diagram';

/**
 * Mermaid diagram NodeView (FR-5.9): rendered read-only in place; click opens
 * the full-screen source/preview editor; the diagram re-renders on Apply.
 */

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

async function renderDiagram(el: HTMLElement, code: string): Promise<void> {
  if (!code.trim()) {
    el.innerHTML = '';
    const empty = document.createElement('span');
    empty.className = 'diagram-placeholder';
    empty.textContent = 'Empty diagram — click to edit';
    el.appendChild(empty);
    return;
  }
  try {
    // Rendered locally with securityLevel:'strict'; no document HTML injected.
    el.innerHTML = await renderMermaidToSvg(code, isDark());
  } catch (err) {
    el.innerHTML = '';
    const error = document.createElement('div');
    error.className = 'mermaid-error';
    error.textContent = `Mermaid: ${err instanceof Error ? err.message.split('\n')[0] : 'diagram error'}`;
    el.appendChild(error);
  }
}

export const diagramView = $view(diagramSchema.node, (): NodeViewConstructor => {
  return (node, view, getPos) => {
    const dom = document.createElement('div');
    dom.className = 'diagram-node';
    dom.dataset.type = 'diagram';
    dom.setAttribute('role', 'button');
    dom.setAttribute('tabindex', '0');
    dom.setAttribute('aria-label', 'Mermaid diagram, click to edit source');

    let value = node.attrs.value as string;
    void renderDiagram(dom, value);

    const open = () => {
      const pos = getPos();
      if (pos === undefined) return;
      const current = view.state.doc.nodeAt(pos);
      if (!current) return;
      openDiagramEditor({
        value: current.attrs.value as string,
        onApply: (next) => {
          // Re-resolve at apply time: the modal outlives any number of
          // document changes, so a position captured on open can be stale.
          const at = getPos();
          if (at === undefined) return;
          const target = view.state.doc.nodeAt(at);
          if (!target || target.type !== node.type) return;
          view.dispatch(
            view.state.tr.setNodeMarkup(at, undefined, { ...target.attrs, value: next }),
          );
        },
        onClose: () => view.focus(),
      });
    };
    dom.addEventListener('click', open);
    dom.addEventListener('keydown', (event) => {
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
          void renderDiagram(dom, value);
        }
        return true;
      },
      ignoreMutation: () => true,
    };
  };
});
