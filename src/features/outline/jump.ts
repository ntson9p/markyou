import { EditorView } from '@codemirror/view';

import { useEditorsStore } from '@/app/store/editors';
import { useDocStore } from '@/core/document/store';
import { topLevelBlockLines } from '@/core/markdown/blocks';

/** Frontmatter lines the raw full-text is ahead of the body. */
export function frontmatterLineOffset(): number {
  const block = useDocStore.getState().frontmatter.rawBlock;
  return block ? block.split('\n').length - 1 : 0;
}

/** Body line → index of the enclosing top-level block. */
export function blockIndexForLine(
  bodyLine: number,
  lines = topLevelBlockLines(useDocStore.getState().body),
): number {
  let idx = 0;
  while (idx + 1 < lines.length && lines[idx + 1] <= bodyLine) idx++;
  return idx;
}

/**
 * Scroll the active editor so a 1-based BODY line is at the top (outline jump,
 * FR-10.1). Raw/dual scroll the CodeMirror pane; single WYSIWYG scrolls the
 * matching top-level block into view.
 */
export function jumpToBodyLine(bodyLine: number): void {
  const { cmView, wysiwygScrollEl } = useEditorsStore.getState();

  if (cmView) {
    const target = Math.min(
      cmView.state.doc.lines,
      Math.max(1, bodyLine + frontmatterLineOffset()),
    );
    const pos = cmView.state.doc.line(target).from;
    cmView.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 8 }),
    });
    cmView.focus();
    return;
  }

  if (wysiwygScrollEl) {
    const pm = wysiwygScrollEl.querySelector<HTMLElement>('.ProseMirror');
    if (!pm) return;
    const idx = blockIndexForLine(bodyLine);
    const child = pm.children[Math.min(idx, pm.children.length - 1)] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
