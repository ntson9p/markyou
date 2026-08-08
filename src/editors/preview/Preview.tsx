import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useDocStore } from '@/core/document/store';
import { renderMermaidBlocks } from '@/editors/preview/mermaid';
import { useResolvedTheme } from '@/features/settings/theme';

const DEBOUNCE_MS = 200; // FR-4.2: ≤ 250 ms after typing stops

interface PreviewProps {
  /** Exposes the scroll container (scroll sync). */
  onContainerReady?: (el: HTMLDivElement | null) => void;
  /** Called after each committed render (scroll-sync anchor invalidation). */
  onRendered?: () => void;
}

/**
 * Live preview (FR-4) via the shared unified pipeline (lazy chunk). The HTML
 * set below is sanitized by rehype-sanitize inside the pipeline — that is the
 * security boundary (§7).
 */
export function Preview({ onContainerReady, onRendered }: PreviewProps) {
  const body = useDocStore((s) => s.body);
  const theme = useResolvedTheme();
  const [html, setHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const renderSeq = useRef(0);
  const firstRender = useRef(true);

  useEffect(() => {
    const seq = ++renderSeq.current;
    const run = async () => {
      const { renderMarkdown } = await import('@/core/markdown/render');
      const rendered = await renderMarkdown(body);
      if (seq !== renderSeq.current) return; // stale
      setHtml(rendered);
    };
    if (firstRender.current) {
      firstRender.current = false;
      void run();
      return;
    }
    const timer = setTimeout(run, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [body]);

  // Post-process mermaid fences after each committed render.
  useEffect(() => {
    if (html === null || !articleRef.current) return;
    onRendered?.();
    void renderMermaidBlocks(articleRef.current, theme === 'dark').then(() => onRendered?.());
  }, [html, theme, onRendered]);

  useEffect(() => {
    onContainerReady?.(containerRef.current);
    return () => onContainerReady?.(null);
  }, [onContainerReady]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-background"
      data-testid="preview"
      aria-label="Preview"
    >
      {html === null ? (
        <div className="flex h-24 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-label="Rendering preview" />
        </div>
      ) : (
        <article
          ref={articleRef}
          // Fills its column rather than sitting in a capped measure: here the
          // splitter is the width control (FR-2.4), so dragging it has to
          // resize the rendered document. The ~72ch measure belongs to WYSIWYG
          // single mode's centred page (§8.1), which has no divider to size the
          // text with.
          className="md-doc w-full px-8 py-6"
          data-testid="preview-doc"
          // Safe by design: `html` comes from the shared pipeline which runs
          // rehype-sanitize (allowlist schema) — see core/markdown/render.ts.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
