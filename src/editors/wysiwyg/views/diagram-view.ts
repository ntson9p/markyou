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

function appendSizeBadge(el: HTMLElement): void {
  if (!DEBUG_DIAGRAM_SIZE) return;
  const svg = el.querySelector('svg');
  if (!svg) return;
  // After layout, so the measured boxes are the real ones.
  requestAnimationFrame(() => {
    if (!svg.isConnected) return;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.getAttribute('viewBox') ?? '(none)';
    const vb = viewBox.split(/\s+/).map(Number);
    const natural = vb[2];
    const scale = Number.isFinite(natural) && natural > 0 ? rect.width / natural : 1;
    const content = boxOf(svg);

    // A canvas past this is never a real diagram (the widest stock type is
    // ~1300); it means a stray element dragged the bounds out.
    const absurd = natural >= 8000 || vb[3] >= 8000;
    if (!absurd && scale > 0.25) return;

    // Name the elements defining the extremes — that is the culprit. Screen
    // space is the only frame comparable across nested transforms, so measure
    // there and convert back to viewBox units.
    const perUnit = rect.width > 0 && natural > 0 ? rect.width / natural : 1;
    let right: { el: Element; v: number } | null = null;
    let bottom: { el: Element; v: number } | null = null;
    let biggest: { el: Element; a: number; box: DOMRect } | null = null;
    for (const node of svg.querySelectorAll(
      'path,rect,circle,ellipse,line,polygon,polyline,text,image,foreignObject',
    )) {
      const r = node.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) continue;
      const vx = vb[0] + (r.right - rect.left) / perUnit;
      const vy = vb[1] + (r.bottom - rect.top) / perUnit;
      if (!right || vx > right.v) right = { el: node, v: vx };
      if (!bottom || vy > bottom.v) bottom = { el: node, v: vy };
      const area = (r.width * r.height) / (perUnit * perUnit);
      if (!biggest || area > biggest.a) biggest = { el: node, a: area, box: r };
    }
    const tag = (n: Element | undefined) =>
      n ? `${n.tagName}.${(n.getAttribute('class') ?? '-').split(/\s+/)[0] || '-'}` : '?';

    const badge = document.createElement('div');
    badge.className = 'diagram-debug-badge';
    badge.textContent = [
      `viewBox: ${viewBox}`,
      `bbox: ${content ? `${Math.round(content.width)}x${Math.round(content.height)}@${Math.round(content.x)},${Math.round(content.y)}` : 'none'}`,
      `drawn: ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      `scale: ${scale.toFixed(3)}`,
      `refit: ${svg.dataset.refit ?? 'no'}`,
      `maxRight: ${tag(right?.el)}@${Math.round(right?.v ?? 0)}`,
      `maxBottom: ${tag(bottom?.el)}@${Math.round(bottom?.v ?? 0)}`,
      `biggest: ${tag(biggest?.el)} area~${Math.round(Math.sqrt(biggest?.a ?? 0))}sq`,
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
