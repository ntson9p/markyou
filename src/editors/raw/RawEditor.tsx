import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';

import { getFullText, useDocStore } from '@/core/document/store';
import { diffToChanges } from '@/editors/raw/diff-apply';
import {
  buildRawExtensions,
  lineNumbersCompartment,
  syncAnnotation,
} from '@/editors/raw/extensions';
import { useSettingsStore } from '@/features/settings/store';
import { useEditorsStore } from '@/app/store/editors';
import { useUiStore } from '@/app/store/ui';

interface RawEditorProps {
  /** Exposes the live EditorView (scroll sync, adapters). */
  onViewReady?: (view: EditorView | null) => void;
  autoFocus?: boolean;
}

/**
 * CodeMirror 6 raw-mode adapter (FR-3). Edits the FULL text (frontmatter
 * included); the store re-splits. Byte-faithful: nothing is ever reformatted
 * (D13) — external updates apply as minimal diffs.
 */
export function RawEditor({ onViewReady, autoFocus = true }: RawEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const docId = useDocStore((s) => s.docId);
  const settingsLineNumbers = useSettingsStore((s) => s.lineNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: getFullText(useDocStore.getState()),
      extensions: buildRawExtensions({
        lineNumbers: useSettingsStore.getState().lineNumbers,
        onUserChange: (text) => useDocStore.getState().setFullText(text, 'raw'),
        onCursor: (line, col) => useUiStore.getState().setCursor({ line, col }),
        onSelectionText: (text) => useEditorsStore.getState().setSelectionText(text),
      }),
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    useEditorsStore.getState().setCmView(view);
    onViewReady?.(view);

    // Store → raw: apply external versions as a minimal diff (plan §2.2).
    const unsubscribe = useDocStore.subscribe((s, prev) => {
      if (s.version === prev.version || s.origin === 'raw' || s.status !== 'open') return;
      const newText = getFullText(s);
      const current = view.state.doc.toString();
      if (current === newText) return; // content-equality short-circuit
      view.dispatch({
        changes: diffToChanges(current, newText),
        annotations: syncAnnotation.of(true),
      });
    });

    if (autoFocus) view.focus();

    return () => {
      unsubscribe();
      onViewReady?.(null);
      const editors = useEditorsStore.getState();
      if (editors.cmView === view) editors.setCmView(null);
      editors.setSelectionText('');
      view.destroy();
      viewRef.current = null;
      useUiStore.getState().setCursor(null);
    };
    // Recreate the editor only when the document identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Live-reconfigure line numbers (FR-3.2 toggle).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: lineNumbersCompartment.reconfigure(settingsLineNumbers ? [lineNumbers()] : []),
    });
  }, [settingsLineNumbers]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
      style={{ '--editor-font-size': `${fontSize}px` } as React.CSSProperties}
      data-testid="raw-editor"
    />
  );
}
