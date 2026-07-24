import { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';

/**
 * Bidirectional raw ↔ preview scroll sync (FR-4.3, plan §2.3): maps source
 * lines to `data-sourcepos` anchors in the preview with interpolation between
 * anchors — anchored, not proportional.
 */

interface Anchor {
  line: number;
  top: number;
}

const LOCK_MS = 120;

export function useRawPreviewScrollSync(options: {
  enabled: boolean;
  /** Lines the raw text is ahead of the preview body (frontmatter block). */
  lineOffset: number;
}) {
  const viewRef = useRef<EditorView | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const anchorsRef = useRef<Anchor[] | null>(null);
  const lockRef = useRef<{ source: 'raw' | 'preview'; until: number } | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const invalidateAnchors = useCallback(() => {
    anchorsRef.current = null;
  }, []);

  const getAnchors = useCallback((): Anchor[] => {
    if (anchorsRef.current) return anchorsRef.current;
    const container = previewRef.current;
    if (!container) return [];
    const containerTop = container.getBoundingClientRect().top;
    const seen = new Set<number>();
    const anchors: Anchor[] = [];
    for (const el of container.querySelectorAll<HTMLElement>('[data-sourcepos]')) {
      const line = Number(el.dataset.sourcepos);
      if (!Number.isFinite(line) || seen.has(line)) continue;
      seen.add(line);
      anchors.push({
        line,
        top: el.getBoundingClientRect().top - containerTop + container.scrollTop,
      });
    }
    anchors.sort((a, b) => a.line - b.line);
    anchorsRef.current = anchors;
    return anchors;
  }, []);

  const locked = (source: 'raw' | 'preview') => {
    const lock = lockRef.current;
    return lock !== null && lock.source !== source && lock.until > performance.now();
  };
  const acquire = (source: 'raw' | 'preview') => {
    lockRef.current = { source, until: performance.now() + LOCK_MS };
  };

  const syncFromRaw = useCallback(() => {
    const view = viewRef.current;
    const container = previewRef.current;
    if (!view || !container || !optionsRef.current.enabled) return;
    if (locked('raw')) return;
    acquire('raw');

    const scrollTop = view.scrollDOM.scrollTop;
    const block = view.lineBlockAtHeight(scrollTop);
    const lineNo = view.state.doc.lineAt(block.from).number;
    const frac = block.height > 0 ? (scrollTop - block.top) / block.height : 0;
    const bodyLine = lineNo + frac - optionsRef.current.lineOffset;

    const anchors = getAnchors();
    if (anchors.length === 0) return;
    const totalLines = Math.max(1, view.state.doc.lines - optionsRef.current.lineOffset);
    const all = [
      { line: 1, top: 0 },
      ...anchors,
      { line: totalLines + 1, top: container.scrollHeight - container.clientHeight },
    ];
    for (let i = all.length - 2; i >= 0; i--) {
      const a = all[i];
      const b = all[i + 1];
      if (bodyLine >= a.line) {
        const t = b.line > a.line ? (bodyLine - a.line) / (b.line - a.line) : 0;
        container.scrollTop = a.top + t * (b.top - a.top);
        return;
      }
    }
  }, [getAnchors]);

  const syncFromPreview = useCallback(() => {
    const view = viewRef.current;
    const container = previewRef.current;
    if (!view || !container || !optionsRef.current.enabled) return;
    if (locked('preview')) return;
    acquire('preview');

    const scrollTop = container.scrollTop;
    const anchors = getAnchors();
    if (anchors.length === 0) return;
    const totalLines = Math.max(1, view.state.doc.lines - optionsRef.current.lineOffset);
    const all = [
      { line: 1, top: 0 },
      ...anchors,
      { line: totalLines + 1, top: container.scrollHeight - container.clientHeight },
    ];
    let bodyLine = 1;
    for (let i = all.length - 2; i >= 0; i--) {
      const a = all[i];
      const b = all[i + 1];
      if (scrollTop >= a.top) {
        const t = b.top > a.top ? (scrollTop - a.top) / (b.top - a.top) : 0;
        bodyLine = a.line + t * (b.line - a.line);
        break;
      }
    }
    const rawLine = Math.max(
      1,
      Math.min(view.state.doc.lines, Math.floor(bodyLine + optionsRef.current.lineOffset)),
    );
    const frac = bodyLine - Math.floor(bodyLine);
    const block = view.lineBlockAt(view.state.doc.line(rawLine).from);
    view.scrollDOM.scrollTop = block.top + frac * block.height;
  }, [getAnchors]);

  // Wire listeners whenever both sides exist.
  const rawListener = useRef<(() => void) | null>(null);
  const previewListener = useRef<(() => void) | null>(null);

  const setView = useCallback(
    (view: EditorView | null) => {
      if (viewRef.current && rawListener.current) {
        viewRef.current.scrollDOM.removeEventListener('scroll', rawListener.current);
        rawListener.current = null;
      }
      viewRef.current = view;
      if (view) {
        rawListener.current = () => syncFromRaw();
        view.scrollDOM.addEventListener('scroll', rawListener.current, { passive: true });
      }
    },
    [syncFromRaw],
  );

  const setPreview = useCallback(
    (el: HTMLDivElement | null) => {
      if (previewRef.current && previewListener.current) {
        previewRef.current.removeEventListener('scroll', previewListener.current);
        previewListener.current = null;
      }
      previewRef.current = el;
      invalidateAnchors();
      if (el) {
        previewListener.current = () => syncFromPreview();
        el.addEventListener('scroll', previewListener.current, { passive: true });
      }
    },
    [syncFromPreview, invalidateAnchors],
  );

  // Invalidate cached anchor geometry on resize.
  useEffect(() => {
    const observer = new ResizeObserver(invalidateAnchors);
    if (previewRef.current) observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [invalidateAnchors]);

  return { setView, setPreview, invalidateAnchors };
}
