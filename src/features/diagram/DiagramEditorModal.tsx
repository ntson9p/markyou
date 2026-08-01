import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore } from '@/app/store/ui';
import { SplitPane } from '@/components/SplitPane';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { refitOversizedCanvas, renderMermaidToSvg } from '@/editors/preview/mermaid';
import { useDiagramEditorStore, type DiagramEditorSession } from '@/features/diagram/store';
import { useResolvedTheme } from '@/features/settings/theme';

/** Idle delay before re-rendering the preview — mermaid parse+render is heavy. */
const RENDER_DEBOUNCE_MS = 200;

function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.split('\n')[0] || 'Diagram error';
}

/**
 * Full-screen mermaid editor (FR-5.9): source on the left, live preview on the
 * right, split by a draggable, keyboard-operable divider whose ratio persists.
 *
 * Edits stay local to the modal until **Apply** — Cancel, Esc, the close
 * button and a backdrop click all funnel through one `attemptClose`, so
 * unsaved work always meets the same in-app confirmation (never
 * `window.confirm`, which can't be styled or tested).
 */
export function DiagramEditorModal() {
  const session = useDiagramEditorStore((s) => s.session);
  // Keyed by session so each open starts with fresh draft state — no reset
  // effect, and no stale draft leaking between diagrams.
  return session ? <DiagramSessionEditor key={session.id} session={session} /> : null;
}

function DiagramSessionEditor({ session }: { session: DiagramEditorSession }) {
  const closeSession = useDiagramEditorStore((s) => s.close);
  const ratio = useUiStore((s) => s.diagramSplit);
  const setRatio = useUiStore((s) => s.setDiagramSplit);
  const isSmall = useIsSmallScreen();
  const dark = useResolvedTheme() === 'dark';

  const [draft, setDraft] = useState(session.value);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Guards against a slow earlier render overwriting a newer one. */
  const renderSeq = useRef(0);
  const mounted = useRef(false);

  const dirty = draft !== session.value;

  // Live preview: debounced, sequenced, and non-destructive — a diagram that
  // stops parsing mid-edit keeps its last good render with the error beneath,
  // instead of blanking the pane on every keystroke.
  useEffect(() => {
    const code = draft.trim();
    const id = ++renderSeq.current;
    // The opening render is immediate (mermaid has it cached from the
    // document); only subsequent keystrokes wait for the typing to settle.
    const delay = mounted.current ? RENDER_DEBOUNCE_MS : 0;
    mounted.current = true;

    const timer = window.setTimeout(() => {
      if (!code) {
        if (previewRef.current) previewRef.current.innerHTML = '';
        setError(null);
        return;
      }
      renderMermaidToSvg(code, dark)
        .then((svg) => {
          if (renderSeq.current !== id) return;
          // Generated locally by mermaid with securityLevel:'strict' — no
          // document-provided HTML is injected (§7 security).
          if (previewRef.current) {
            previewRef.current.innerHTML = svg;
            refitOversizedCanvas(previewRef.current);
          }
          setError(null);
        })
        .catch((err: unknown) => {
          if (renderSeq.current !== id) return;
          setError(firstLine(err));
        });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [draft, dark]);

  const attemptClose = useCallback(() => {
    // Esc / backdrop while confirming dismisses the confirmation only.
    if (confirmOpen) {
      setConfirmOpen(false);
      textareaRef.current?.focus();
      return;
    }
    if (dirty) {
      setConfirmOpen(true);
      return;
    }
    closeSession();
  }, [confirmOpen, dirty, closeSession]);

  const apply = useCallback(() => {
    session.onApply(draft);
    closeSession();
  }, [session, draft, closeSession]);

  const source = (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            apply();
          } else if (e.key === 'Tab' && !e.shiftKey) {
            // Indentation belongs in the diagram, not in the tab order.
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: from, selectionEnd: to } = el;
            setDraft(`${draft.slice(0, from)}  ${draft.slice(to)}`);
            requestAnimationFrame(() => el.setSelectionRange(from + 2, from + 2));
          }
        }}
        spellCheck={false}
        // The user clicked the diagram to edit it — start in the source.
        autoFocus
        aria-label="Mermaid source"
        data-testid="diagram-source"
        placeholder={'graph TD\n  A --> B'}
        className="h-full w-full resize-none bg-transparent p-3 font-mono text-sm leading-relaxed text-foreground outline-none"
      />
    </div>
  );

  const preview = (
    <div className="flex h-full min-h-0 flex-col">
      {/* The scroller stays a plain block and the centring lives on an inner
          `min-h-full` wrapper: centring the scroll container itself would put
          the top of a tall diagram out of scroll range. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          ref={previewRef}
          data-testid="diagram-preview"
          aria-label="Diagram preview"
          aria-live="polite"
          // No width bounds here — mermaid's inline ones outrank any rule we
          // could write. Centring is `mx-auto` on the diagram rather than
          // `justify-center`, which would put the left edge of an over-wide
          // one outside the scroll range.
          className="flex min-h-full items-center p-4 [&_svg]:mx-auto [&_svg]:h-auto"
        />
      </div>
      {error && (
        <div
          role="status"
          data-testid="diagram-error"
          className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open
      onClose={attemptClose}
      title="Edit Mermaid diagram"
      size="full"
      bodyClassName="p-0 overflow-hidden"
      footer={
        <>
          <Button variant="outline" onClick={attemptClose} data-testid="diagram-cancel">
            Cancel
          </Button>
          <Button onClick={apply} data-testid="diagram-apply">
            Apply
          </Button>
        </>
      }
    >
      <div className="h-full min-h-0" data-testid="diagram-editor">
        {isSmall ? (
          // §8.2: two columns don't fit a phone — stack source over preview.
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 border-b border-border">{source}</div>
            <div className="min-h-0 flex-1">{preview}</div>
          </div>
        ) : (
          <SplitPane
            ratio={ratio}
            onRatioChange={setRatio}
            dividerLabel="Resize source and preview"
            left={source}
            right={preview}
          />
        )}
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) attemptClose();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="diagram-confirm-title"
            data-testid="diagram-confirm"
            className="w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-xl"
          >
            <h3 id="diagram-confirm-title" className="text-sm font-semibold">
              Discard your changes?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This diagram has unsaved edits. Closing now loses them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                autoFocus
                onClick={() => {
                  setConfirmOpen(false);
                  textareaRef.current?.focus();
                }}
              >
                Keep editing
              </Button>
              <Button variant="destructive" onClick={closeSession} data-testid="diagram-discard">
                Discard changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
