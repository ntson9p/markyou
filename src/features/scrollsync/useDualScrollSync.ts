import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

import { useDocStore } from '@/core/document/store';
import { parseMarkdown } from '@/core/markdown/parse';

/**
 * Best-effort dual-pane scroll sync (FR-6.3, plan §2.3): maps by **top-level
 * block index** — mdast children and ProseMirror doc children align by
 * construction. The raw pane's line → block index comes from the shared AST;
 * the WYSIWYG pane's block tops come from the rendered `.ProseMirror` children.
 * A short cross-lock stops the two panes fighting each other.
 */

const LOCK_MS = 120;

/** 1-based body start line of each top-level block (shared grammar). */
function computeBlockStartLines(body: string): number[] {
  const tree = parseMarkdown(body);
  const lines = tree.children
    .map((c) => c.position?.start.line ?? 1)
    .filter((n) => Number.isFinite(n));
  return lines.length > 0 ? lines : [1];
}

function frontmatterLineOffset(): number {
  const block = useDocStore.getState().frontmatter.rawBlock;
  return block ? block.split('\n').length - 1 : 0;
}

export function useDualScrollSync() {
  const rawViewRef = useRef<EditorView | null>(null);
  const wysiwygRef = useRef<HTMLDivElement | null>(null);
  const blockLinesRef = useRef<number[] | null>(null);
  const lockRef = useRef<{ source: 'raw' | 'wysiwyg'; until: number } | null>(null);
  const rawListenerRef = useRef<(() => void) | null>(null);
  const wysiwygListenerRef = useRef<(() => void) | null>(null);

  const invalidate = useCallback(() => {
    blockLinesRef.current = null;
  }, []);

  // Recompute block boundaries when the body changes.
  useEffect(() => useDocStore.subscribe((s, p) => s.body !== p.body && invalidate()), [invalidate]);

  const blockLines = useCallback((): number[] => {
    blockLinesRef.current ??= computeBlockStartLines(useDocStore.getState().body);
    return blockLinesRef.current;
  }, []);

  const locked = (source: 'raw' | 'wysiwyg') => {
    const lock = lockRef.current;
    return lock !== null && lock.source !== source && lock.until > performance.now();
  };
  const acquire = (source: 'raw' | 'wysiwyg') => {
    lockRef.current = { source, until: performance.now() + LOCK_MS };
  };

  /** Top offsets (within the scroll container) of each rendered top block. */
  const blockTops = useCallback((): number[] => {
    const container = wysiwygRef.current;
    const pm = container?.querySelector<HTMLElement>('.ProseMirror');
    if (!container || !pm) return [];
    const cTop = container.getBoundingClientRect().top - container.scrollTop;
    return Array.from(pm.children).map(
      (child) => (child as HTMLElement).getBoundingClientRect().top - cTop,
    );
  }, []);

  const syncFromRaw = useCallback(() => {
    const view = rawViewRef.current;
    const container = wysiwygRef.current;
    if (!view || !container || locked('raw')) return;
    acquire('raw');

    const scrollTop = view.scrollDOM.scrollTop;
    const block = view.lineBlockAtHeight(scrollTop);
    const rawLine = view.state.doc.lineAt(block.from).number;
    const frac = block.height > 0 ? (scrollTop - block.top) / block.height : 0;
    const bodyLine = rawLine + frac - frontmatterLineOffset();

    const lines = blockLines();
    const tops = blockTops();
    if (tops.length === 0) return;

    let idx = 0;
    while (idx + 1 < lines.length && lines[idx + 1] <= bodyLine) idx++;
    idx = Math.min(idx, tops.length - 1);
    const startLine = lines[idx];
    const nextLine = lines[idx + 1] ?? startLine + 1;
    const t = nextLine > startLine ? (bodyLine - startLine) / (nextLine - startLine) : 0;
    const top = tops[idx];
    const nextTop = tops[idx + 1] ?? container.scrollHeight;
    container.scrollTop = top + Math.max(0, Math.min(1, t)) * (nextTop - top);
  }, [blockLines, blockTops]);

  const syncFromWysiwyg = useCallback(() => {
    const view = rawViewRef.current;
    const container = wysiwygRef.current;
    if (!view || !container || locked('wysiwyg')) return;
    acquire('wysiwyg');

    const scrollTop = container.scrollTop;
    const lines = blockLines();
    const tops = blockTops();
    if (tops.length === 0) return;

    let idx = 0;
    while (idx + 1 < tops.length && tops[idx + 1] <= scrollTop) idx++;
    const top = tops[idx];
    const nextTop = tops[idx + 1] ?? container.scrollHeight;
    const t = nextTop > top ? (scrollTop - top) / (nextTop - top) : 0;
    const startLine = lines[Math.min(idx, lines.length - 1)];
    const nextLine = lines[idx + 1] ?? startLine + 1;
    const bodyLine = startLine + Math.max(0, Math.min(1, t)) * (nextLine - startLine);

    const rawLine = Math.max(
      1,
      Math.min(view.state.doc.lines, Math.floor(bodyLine + frontmatterLineOffset())),
    );
    const lineBlock = view.lineBlockAt(view.state.doc.line(rawLine).from);
    const rowFrac = bodyLine - Math.floor(bodyLine);
    view.scrollDOM.scrollTop = lineBlock.top + rowFrac * lineBlock.height;
  }, [blockLines, blockTops]);

  const setRawView = useCallback(
    (view: EditorView | null) => {
      const prev = rawViewRef.current;
      if (prev && rawListenerRef.current) {
        prev.scrollDOM.removeEventListener('scroll', rawListenerRef.current);
        rawListenerRef.current = null;
      }
      rawViewRef.current = view;
      if (view) {
        rawListenerRef.current = () => syncFromRaw();
        view.scrollDOM.addEventListener('scroll', rawListenerRef.current, { passive: true });
      }
    },
    [syncFromRaw],
  );

  const setWysiwygContainer = useCallback(
    (el: HTMLDivElement | null) => {
      const prev = wysiwygRef.current;
      if (prev && wysiwygListenerRef.current) {
        prev.removeEventListener('scroll', wysiwygListenerRef.current);
        wysiwygListenerRef.current = null;
      }
      wysiwygRef.current = el;
      if (el) {
        wysiwygListenerRef.current = () => syncFromWysiwyg();
        el.addEventListener('scroll', wysiwygListenerRef.current, { passive: true });
      }
    },
    [syncFromWysiwyg],
  );

  return { setRawView, setWysiwygContainer };
}
