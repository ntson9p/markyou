import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, Undo2, X } from 'lucide-react';

import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore } from '@/app/store/ui';
import { Button } from '@/components/ui/button';
import { getFullText, useDocStore } from '@/core/document/store';
import {
  createDiffEditor,
  type ChunkInfo,
  type DiffEditorHandle,
} from '@/features/diff/diff-editor';
import { useDiffStats } from '@/features/diff/stats';
import { saveDocument } from '@/features/files/actions';
import { useSettingsStore } from '@/features/settings/store';
import { takeSnapshot } from '@/features/snapshots/snapshots';
import { cn } from '@/lib/utils';

/**
 * Review Changes: a full-viewport overlay diffing the current document against
 * its last saved version (JetBrains-style). The right/editable side is the
 * live document — edits sync through the store immediately, there is no
 * "apply" step, and reverts are ordinary undoable editor transactions.
 */
export function DiffOverlay() {
  const status = useDocStore((s) => s.status);
  const dirty = useDocStore((s) => s.dirty);
  const neverSaved = useDocStore((s) => s.savedText === null);
  const fileName = useDocStore((s) => s.file?.name ?? 'Untitled');
  const docId = useDocStore((s) => s.docId);
  const layoutPref = useUiStore((s) => s.diffLayout);
  const setDiffLayout = useUiStore((s) => s.setDiffLayout);
  const collapse = useUiStore((s) => s.diffCollapse);
  const toggleCollapse = useUiStore((s) => s.toggleDiffCollapse);
  const wrap = useUiStore((s) => s.diffWrap);
  const toggleWrap = useUiStore((s) => s.toggleDiffWrap);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const isSmall = useIsSmallScreen();
  const stats = useDiffStats();

  const [chunkInfo, setChunkInfo] = useState<ChunkInfo>({ current: 0, total: 0 });
  const [wasDirty, setWasDirty] = useState(dirty);
  const handleRef = useRef<DiffEditorHandle | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Dual is desktop-only and so is a split diff (D4): phones read top-to-bottom.
  const layout = isSmall ? 'unified' : layoutPref;
  const close = useCallback(() => setActivePanel(null), [setActivePanel]);

  // Render-time adjustment (not an effect): once dirty has been seen, the
  // clean state reads "All changes saved" instead of "No unsaved changes".
  if (dirty && !wasDirty) setWasDirty(true);

  // The document was closed underneath the overlay — nothing left to review.
  useEffect(() => {
    if (status !== 'open') close();
  }, [status, close]);

  // Esc to close + a simple focus wrap (mirrors the Modal primitive; this
  // overlay isn't a Modal because its header IS the toolbar, not a title row).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeInPanel = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !activeInPanel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [close]);

  // The clean state has no editor to focus — take it ourselves so Esc works.
  useEffect(() => {
    if (!dirty) panelRef.current?.focus();
  }, [dirty]);

  const onHandle = useCallback((h: DiffEditorHandle | null) => {
    handleRef.current = h;
  }, []);
  const onChunkInfo = useCallback((info: ChunkInfo) => setChunkInfo(info), []);

  const onRevertAll = useCallback(() => {
    // Snapshot first so "Revert all" is recoverable from History even after
    // the editor's undo stack is gone (same safety net as FR-12.3 restore).
    const s = useDocStore.getState();
    void takeSnapshot(s.docId, getFullText(s), 'restore');
    handleRef.current?.revertAll();
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Review changes"
      data-testid="diff-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-background outline-none"
      onKeyDown={(e) => {
        // Alt+↑/↓ work anywhere in the overlay; the editor's own keymap has
        // already handled (and defaultPrevented) them when it had focus.
        if (e.defaultPrevented || !e.altKey) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleRef.current?.nextChunk();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleRef.current?.prevChunk();
        }
      }}
    >
      <header
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5"
        data-testid="diff-header"
      >
        <h2 className="text-sm font-semibold">Review changes</h2>
        <span className="max-w-48 truncate text-sm text-muted-foreground">{fileName}</span>
        <span className="text-xs text-muted-foreground">
          {neverSaved ? 'vs. new empty document' : 'vs. last saved version'}
        </span>
        {dirty && stats && (
          <span data-testid="diff-stats" className="text-xs tabular-nums">
            <span className="text-diff-add">+{stats.added}</span>{' '}
            <span className="text-diff-del">−{stats.removed}</span>
          </span>
        )}
        <span className="flex-1" />
        {dirty && (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRef.current?.prevChunk()}
                aria-label="Previous change (Alt+Up)"
                title="Previous change (Alt+↑)"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRef.current?.nextChunk()}
                aria-label="Next change (Alt+Down)"
                title="Next change (Alt+↓)"
                data-testid="diff-next-chunk"
              >
                <ArrowDown className="size-4" />
              </Button>
              <span
                data-testid="diff-chunk-pos"
                className="min-w-14 text-center text-xs tabular-nums text-muted-foreground"
              >
                {chunkInfo.total === 0
                  ? 'No changes'
                  : `${chunkInfo.current || '–'} / ${chunkInfo.total}`}
              </span>
            </div>
            {!isSmall && (
              <div
                role="group"
                aria-label="Diff layout"
                className="flex overflow-hidden rounded-md border border-border text-xs"
              >
                {(['split', 'unified'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    data-testid={`diff-layout-${l}`}
                    aria-pressed={layout === l}
                    onClick={() => setDiffLayout(l)}
                    className={cn(
                      'px-2.5 py-1 capitalize',
                      layout === l
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
            <Button
              variant={collapse ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={collapse}
              onClick={toggleCollapse}
              title="Collapse unchanged regions"
              className="h-7 px-2 text-xs"
            >
              Collapse
            </Button>
            <Button
              variant={wrap ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={wrap}
              onClick={toggleWrap}
              title="Wrap long lines"
              className="h-7 px-2 text-xs"
            >
              Wrap
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRevertAll}
              data-testid="diff-revert-all"
              className="h-7 px-2 text-xs"
            >
              <Undo2 className="size-3.5" /> Revert all
            </Button>
            <Button
              size="sm"
              onClick={() => void saveDocument()}
              data-testid="diff-save"
              className="h-7 px-2.5 text-xs"
            >
              Save
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={close}
          aria-label="Close (Esc)"
          data-testid="diff-close"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1">
        {dirty ? (
          <DiffEditorPane
            key={`${docId}:${layout}:${collapse}:${wrap}`}
            layout={layout}
            collapse={collapse}
            wrap={wrap}
            onChunkInfo={onChunkInfo}
            onHandle={onHandle}
          />
        ) : (
          <div
            data-testid="diff-empty"
            className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-diff-add/15">
              <Check className="size-6 text-diff-add" />
            </div>
            <p className="text-sm font-medium">
              {wasDirty ? 'All changes saved' : 'No unsaved changes'}
            </p>
            <p className="text-xs text-muted-foreground">The document matches the saved file.</p>
            <Button variant="outline" size="sm" onClick={close}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

interface DiffEditorPaneProps {
  layout: 'split' | 'unified';
  collapse: boolean;
  wrap: boolean;
  onChunkInfo: (info: ChunkInfo) => void;
  onHandle: (handle: DiffEditorHandle | null) => void;
}

function DiffEditorPane({ layout, collapse, wrap, onChunkInfo, onHandle }: DiffEditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);

  useEffect(() => {
    if (!containerRef.current) return;
    const handle = createDiffEditor({
      parent: containerRef.current,
      layout,
      original: useDocStore.getState().savedText ?? '',
      wrap,
      collapse,
      onChunkInfo,
    });
    onHandle(handle);
    handle.focus();
    return () => {
      onHandle(null);
      handle.destroy();
    };
  }, [layout, collapse, wrap, onChunkInfo, onHandle]);

  return (
    <div
      ref={containerRef}
      data-testid="diff-editor"
      className={cn(
        'h-full overflow-hidden',
        // Unified: one editor that owns its scrolling. Split: the merge view
        // wrapper scrolls both aligned editors together (its base theme forces
        // the inner editors to auto height).
        '[&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto',
        '[&_.cm-mergeView]:h-full [&_.cm-mergeView]:overflow-auto',
      )}
      style={{ '--editor-font-size': `${fontSize}px` } as React.CSSProperties}
    />
  );
}
