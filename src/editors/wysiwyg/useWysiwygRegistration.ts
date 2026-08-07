import { useCallback, useState } from 'react';

import type { Editor } from '@milkdown/kit/core';
import type { EditorState } from '@milkdown/kit/prose/state';

import { useEditorsStore } from '@/app/store/editors';

import {
  computeSelectionState,
  INITIAL_SELECTION_STATE,
  selectionStatesEqual,
  type WysiwygSelectionState,
} from './selection-state';

/**
 * Shared wiring for the WYSIWYG-bearing modes (single + dual): tracks toolbar
 * selection state and registers the editor + selection text in the editors
 * store (FR-9 find, FR-10 outline/counts). Returns callbacks the mode passes to
 * `WysiwygEditor` and a ref for its scroll container.
 */
export function useWysiwygRegistration() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectionState, setSelectionState] =
    useState<WysiwygSelectionState>(INITIAL_SELECTION_STATE);

  const onEditorReady = useCallback((next: Editor | null) => {
    setEditor(next);
    const editors = useEditorsStore.getState();
    editors.setPmEditor(next);
    if (!next) editors.setSelectionText('');
  }, []);

  const onStateChange = useCallback((state: EditorState) => {
    setSelectionState((prev) => {
      const next = computeSelectionState(state);
      return selectionStatesEqual(prev, next) ? prev : next;
    });
    const { from, to, empty } = state.selection;
    useEditorsStore
      .getState()
      .setSelectionText(empty ? '' : state.doc.textBetween(from, to, ' ', ' '));
  }, []);

  const registerScrollEl = useCallback((el: HTMLElement | null) => {
    useEditorsStore.getState().setWysiwygScrollEl(el);
  }, []);

  return { editor, selectionState, onEditorReady, onStateChange, registerScrollEl };
}
