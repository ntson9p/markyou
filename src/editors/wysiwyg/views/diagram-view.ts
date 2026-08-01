import { $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';

import { refitWhenAttached, renderMermaidToSvg } from '@/editors/preview/mermaid';
import { openDiagramEditor } from '@/features/diagram/store';

import { diagramSchema } from '../nodes/diagram';

/**
 * Mermaid diagram NodeView (FR-5.9): rendered read-only in place; click opens
 * the full-screen source/preview editor; the diagram re-renders on Apply.
 */

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/**
 * TEMPORARY diagnostic — REMOVE once the diagram-sizing report is closed.
 *
 * Prints the numbers that separate "mermaid produced a tiny drawing" from
 * "our layout shrank a correctly-sized one", so the answer can be read off a
 * screenshot instead of a console session.
 */
const DEBUG_DIAGRAM_SIZE = true;

function boxOf(node: Element): DOMRect | null {
  try {
    return (node as SVGGraphicsElement).getBBox();
  } catch {
    return null;
  }
}

function describe(node: Element, box: DOMRect): string {
  const cls = (node.getAttribute('class') ?? '').split(/\s+/)[0] || '-';
  const id = node.getAttribute('id') ?? '';
  return (
    `${node.tagName}.${cls}${id ? `#${id.slice(0, 14)}` : ''} ` +
    `${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.x)},${Math.round(box.y)}`
  );
}

function appendSizeBadge(el: HTMLElement): void {
  if (!DEBUG_DIAGRAM_SIZE) return;
  const svg = el.querySelector('svg');
  if (!svg) return;
  // After layout, so the measured boxes are the real ones.
  requestAnimationFrame(() => {
    if (!svg.isConnected) return;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.getAttribute('viewBox') ?? '(none)';
    const natural = Number.parseFloat(viewBox.split(/\s+/)[2] ?? 'NaN');
    const scale = Number.isFinite(natural) ? rect.width / natural : 1;
    const content = boxOf(svg);

    // Quiet unless the canvas is still bigger than the drawing after repair.
    // A low scale on its own is not a fault — a large diagram in a narrow
    // column is legitimately scaled well below 1.
    const stillOversized =
      content !== null &&
      content.width > 0 &&
      Number.isFinite(natural) &&
      natural >= content.width * 4;
    if (!stillOversized) return;

    const badge = document.createElement('div');
    badge.className = 'diagram-debug-badge';
    badge.textContent = [
      `viewBox: ${viewBox}`,
      `drawn: ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      `col: ${el.clientWidth}`,
      `scale: ${scale.toFixed(3)}`,
      `content: ${content ? describe(svg, content) : 'unmeasurable'}`,
    ].join('  |  ');
    el.appendChild(badge);
  });
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
    refitWhenAttached(el);
    appendSizeBadge(el);
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
