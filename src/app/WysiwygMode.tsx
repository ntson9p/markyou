import { useCallback, useState } from 'react';

import type { Editor } from '@milkdown/kit/core';
import type { EditorState } from '@milkdown/kit/prose/state';

import { useDocStore } from '@/core/document/store';
import {
  computeSelectionState,
  INITIAL_SELECTION_STATE,
  type WysiwygSelectionState,
} from '@/editors/wysiwyg/selection-state';
import { WysiwygToolbar } from '@/editors/wysiwyg/Toolbar';
import { WysiwygEditor } from '@/editors/wysiwyg/WysiwygEditor';

import '@/styles/wysiwyg.css';

/**
 * WYSIWYG single mode (§8.1): fixed toolbar + centered Docs-like page
 * (max measure ~72ch, generous whitespace).
 */
export function WysiwygMode() {
  const docId = useDocStore((s) => s.docId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectionState, setSelectionState] =
    useState<WysiwygSelectionState>(INITIAL_SELECTION_STATE);

  const handleStateChange = useCallback((state: EditorState) => {
    setSelectionState((prev) => {
      const next = computeSelectionState(state);
      // Avoid re-render churn while typing plain text.
      for (const key of Object.keys(next) as (keyof WysiwygSelectionState)[]) {
        if (next[key] !== prev[key]) return next;
      }
      return prev;
    });
  }, []);

  return (
    <div className="flex h-full flex-col">
      <WysiwygToolbar editor={editor} state={selectionState} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 motion-safe:scroll-smooth">
        <div className="mx-auto my-8 min-h-[70%] w-full max-w-[min(72ch,calc(100%-2rem))] rounded-lg border border-border/60 bg-background px-10 py-12 shadow-sm">
          <WysiwygEditor key={docId} onEditorReady={setEditor} onStateChange={handleStateChange} />
        </div>
      </div>
    </div>
  );
}
