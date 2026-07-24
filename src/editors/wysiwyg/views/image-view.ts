import { imageSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { NodeSelection } from '@milkdown/kit/prose/state';
import type { EditorView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import { $view } from '@milkdown/kit/utils';

import { resolveRelativeAsset } from '@/features/images/assets';

const ABSOLUTE = /^(data:|https?:|blob:|\/)/i;

/** Point the <img> at the right URL, resolving relative `assets/…` (FR-8.4). */
function applySrc(img: HTMLImageElement, src: string) {
  if (!src) return;
  if (ABSOLUTE.test(src)) {
    img.removeAttribute('data-missing');
    img.src = src;
    return;
  }
  void resolveRelativeAsset(src).then((url) => {
    if (url) {
      img.removeAttribute('data-missing');
      img.src = url;
    } else {
      // No folder access — show a placeholder prompting to grant it.
      img.removeAttribute('src');
      img.setAttribute('data-missing', src);
    }
  });
}

/** A small popover to edit alt text or remove the image (FR-8.5). */
function openImagePopover(anchor: HTMLElement, view: EditorView, getPos: () => number | undefined) {
  document.querySelector('.image-popover')?.remove();
  const pos = getPos();
  if (pos == null) return;
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;

  const panel = document.createElement('div');
  panel.className = 'image-popover';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Image');

  const label = document.createElement('label');
  label.className = 'image-popover-label';
  label.textContent = 'Alt text';
  const input = document.createElement('input');
  input.className = 'image-popover-input';
  input.value = (node.attrs.alt as string) ?? '';
  label.appendChild(input);

  const actions = document.createElement('div');
  actions.className = 'image-popover-actions';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'image-popover-btn image-popover-remove';
  remove.textContent = 'Remove';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'image-popover-btn image-popover-primary';
  done.textContent = 'Done';
  actions.append(remove, done);
  panel.append(label, actions);
  document.body.appendChild(panel);

  const rect = anchor.getBoundingClientRect();
  panel.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 280)}px`;
  panel.style.top = `${rect.bottom + window.scrollY + 6}px`;

  const close = () => {
    document.removeEventListener('pointerdown', onOutside, true);
    panel.remove();
  };
  const onOutside = (e: PointerEvent) => {
    if (!panel.contains(e.target as Node) && e.target !== anchor) close();
  };
  const applyAlt = () => {
    const p = getPos();
    if (p != null) view.dispatch(view.state.tr.setNodeAttribute(p, 'alt', input.value));
  };

  input.addEventListener('input', applyAlt);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });
  remove.addEventListener('click', () => {
    const p = getPos();
    if (p != null) view.dispatch(view.state.tr.delete(p, p + 1));
    close();
  });
  done.addEventListener('click', close);
  document.addEventListener('pointerdown', onOutside, true);
  input.focus();
}

const imageNodeView: NodeViewConstructor = (initial, view, getPos) => {
  let node = initial as ProseNode;
  const dom = document.createElement('span');
  dom.className = 'md-image';
  const img = document.createElement('img');
  img.alt = (node.attrs.alt as string) ?? '';
  if (node.attrs.title) img.title = node.attrs.title as string;
  applySrc(img, (node.attrs.src as string) ?? '');
  dom.appendChild(img);

  img.addEventListener('mousedown', (e) => {
    // Select the image node on click (FR-8.5), then open its editor.
    e.preventDefault();
    const pos = getPos();
    if (pos != null)
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    openImagePopover(img, view, getPos);
  });

  return {
    dom,
    update(updated) {
      if (updated.type !== node.type) return false;
      node = updated as ProseNode;
      img.alt = (node.attrs.alt as string) ?? '';
      applySrc(img, (node.attrs.src as string) ?? '');
      return true;
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode');
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode');
    },
  };
};

export const imageView = $view(imageSchema.node, () => imageNodeView);
