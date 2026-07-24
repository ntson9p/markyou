import { create } from 'zustand';
import type { EditorView as CmView } from '@codemirror/view';
import type { Editor } from '@milkdown/kit/core';

/**
 * Live registry of the mounted editor instances, so app-level features
 * (outline jump FR-10.1, find bar FR-9, selection counts FR-10.2) can command
 * the active editor without threading refs through the component tree. Editors
 * register on mount and clear on unmount. Not persisted.
 */
interface EditorsState {
  /** CodeMirror view (raw + dual left pane). */
  cmView: CmView | null;
  setCmView: (v: CmView | null) => void;

  /** Milkdown editor (wysiwyg + dual right pane). */
  pmEditor: Editor | null;
  setPmEditor: (e: Editor | null) => void;

  /** The scroll container wrapping the WYSIWYG `.ProseMirror` (for jumps). */
  wysiwygScrollEl: HTMLElement | null;
  setWysiwygScrollEl: (el: HTMLElement | null) => void;

  /** Plain text of the active editor's selection ('' when collapsed). */
  selectionText: string;
  setSelectionText: (text: string) => void;
}

export const useEditorsStore = create<EditorsState>()((set) => ({
  cmView: null,
  setCmView: (cmView) => set({ cmView }),
  pmEditor: null,
  setPmEditor: (pmEditor) => set({ pmEditor }),
  wysiwygScrollEl: null,
  setWysiwygScrollEl: (wysiwygScrollEl) => set({ wysiwygScrollEl }),
  selectionText: '',
  setSelectionText: (selectionText) => set({ selectionText }),
}));
