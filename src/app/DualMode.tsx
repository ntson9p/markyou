import { useCallback, useState } from 'react';

import type { Editor } from '@milkdown/kit/core';
import type { EditorState } from '@milkdown/kit/prose/state';
import { AlertTriangle } from 'lucide-react';

import { useUiStore } from '@/app/store/ui';
import { SplitPane } from '@/components/SplitPane';
import { useDocStore } from '@/core/document/store';
import { RawEditor } from '@/editors/raw/RawEditor';
import { WysiwygEditor } from '@/editors/wysiwyg/WysiwygEditor';
import { WysiwygToolbar } from '@/editors/wysiwyg/Toolbar';
import {
  computeSelectionState,
  INITIAL_SELECTION_STATE,
  type WysiwygSelectionState,
} from '@/editors/wysiwyg/selection-state';
import { useDualScrollSync } from '@/features/scrollsync/useDualScrollSync';

import '@/styles/wysiwyg.css';

function ParseErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="sticky top-0 z-20 flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      data-testid="wysiwyg-parse-error"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div>
        <div className="font-medium">This document can’t be shown in the rich editor.</div>
        <div className="text-destructive/80">
          Keep editing in the source pane — your text is safe. {message}
        </div>
      </div>
    </div>
  );
}

/**
 * Dual mode (FR-2.4, FR-6): raw source (CodeMirror) on the left, WYSIWYG
 * (Milkdown) on the right, both editing the same `DocumentStore` through the
 * §2 sync protocol. The panes never talk to each other — each is an adapter
 * that pushes with its origin and applies external versions under the three
 * loop-safety guards. A shared toolbar drives the WYSIWYG pane.
 */
export function DualMode() {
  const docId = useDocStore((s) => s.docId);
  const dualSplit = useUiStore((s) => s.dualSplit);
  const setDualSplit = useUiStore((s) => s.setDualSplit);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectionState, setSelectionState] =
    useState<WysiwygSelectionState>(INITIAL_SELECTION_STATE);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleStateChange = useCallback((state: EditorState) => {
    setSelectionState((prev) => {
      const next = computeSelectionState(state);
      for (const key of Object.keys(next) as (keyof WysiwygSelectionState)[]) {
        if (next[key] !== prev[key]) return next;
      }
      return prev;
    });
  }, []);

  const { setRawView, setWysiwygContainer } = useDualScrollSync();

  return (
    <div className="flex h-full flex-col">
      <WysiwygToolbar editor={editor} state={selectionState} />
      <div className="min-h-0 flex-1">
        <SplitPane
          ratio={dualSplit}
          onRatioChange={setDualSplit}
          dividerLabel="Resize source and rich editor"
          left={<RawEditor onViewReady={setRawView} autoFocus={false} />}
          right={
            <div
              ref={setWysiwygContainer}
              className="relative h-full overflow-y-auto border-l bg-background motion-safe:scroll-smooth"
              data-testid="dual-wysiwyg-pane"
            >
              {parseError && <ParseErrorBanner message={parseError} />}
              <div className="mx-auto w-full max-w-[72ch] px-6 py-6">
                <WysiwygEditor
                  key={docId}
                  onEditorReady={setEditor}
                  onStateChange={handleStateChange}
                  onParseError={setParseError}
                />
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
