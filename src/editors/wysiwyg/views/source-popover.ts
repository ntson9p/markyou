/**
 * Shared floating source editor for atom nodes (math, mermaid, raw HTML):
 * a small panel anchored to the node with a textarea, optional live preview,
 * Apply/Cancel, Esc-to-close and click-outside-to-close (FR-5.8/5.9/5.11).
 * Plain DOM — usable from ProseMirror NodeViews without a React bridge.
 */

export interface SourcePopoverOptions {
  anchor: HTMLElement;
  value: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
  /** Called on every input when provided — renders the live preview. */
  onPreview?: (value: string, previewEl: HTMLElement) => void;
  onApply: (value: string) => void;
  onClose?: () => void;
}

export interface SourcePopoverHandle {
  close: () => void;
}

let active: SourcePopoverHandle | null = null;

export function openSourcePopover(options: SourcePopoverOptions): SourcePopoverHandle {
  active?.close();

  const panel = document.createElement('div');
  panel.className = 'source-popover';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', options.label);

  const heading = document.createElement('div');
  heading.className = 'source-popover-label';
  heading.textContent = options.label;
  panel.appendChild(heading);

  const textarea = document.createElement('textarea');
  textarea.className = 'source-popover-input';
  textarea.value = options.value;
  textarea.rows =
    options.multiline === false
      ? 1
      : Math.min(12, Math.max(3, options.value.split('\n').length + 1));
  textarea.placeholder = options.placeholder ?? '';
  textarea.spellcheck = false;
  panel.appendChild(textarea);

  let previewEl: HTMLElement | null = null;
  if (options.onPreview) {
    previewEl = document.createElement('div');
    previewEl.className = 'source-popover-preview';
    panel.appendChild(previewEl);
    options.onPreview(options.value, previewEl);
  }

  const actions = document.createElement('div');
  actions.className = 'source-popover-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'source-popover-btn';
  cancelBtn.textContent = 'Cancel';
  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'source-popover-btn source-popover-btn-primary';
  applyBtn.textContent = 'Apply';
  actions.append(cancelBtn, applyBtn);
  panel.appendChild(actions);

  document.body.appendChild(panel);

  // Anchor below the node, clamped to the viewport.
  const rect = options.anchor.getBoundingClientRect();
  const panelWidth = Math.min(480, Math.max(280, rect.width));
  panel.style.width = `${panelWidth}px`;
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - panelWidth - 8));
  const top = rect.bottom + 6;
  panel.style.left = `${left + window.scrollX}px`;
  panel.style.top = `${top + window.scrollY}px`;

  const close = () => {
    if (!panel.isConnected) return;
    document.removeEventListener('pointerdown', onOutside, true);
    panel.remove();
    if (active === handle) active = null;
    options.onClose?.();
  };

  const apply = () => {
    const next = textarea.value;
    close();
    options.onApply(next);
  };

  const onOutside = (event: PointerEvent) => {
    if (!panel.contains(event.target as Node)) close();
  };

  cancelBtn.addEventListener('click', close);
  applyBtn.addEventListener('click', apply);
  textarea.addEventListener('input', () => {
    if (previewEl && options.onPreview) options.onPreview(textarea.value, previewEl);
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (
      event.key === 'Enter' &&
      (event.ctrlKey || event.metaKey || options.multiline === false)
    ) {
      event.preventDefault();
      apply();
    }
  });
  document.addEventListener('pointerdown', onOutside, true);

  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  const handle: SourcePopoverHandle = { close };
  active = handle;
  return handle;
}
