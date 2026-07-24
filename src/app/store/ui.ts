import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The three editing modes (FR-2.1). */
export type EditorMode = 'raw' | 'wysiwyg' | 'dual';

interface UiState {
  /** Default is WYSIWYG (D3); last-used mode persists per device (FR-2.3). */
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  /** Raw-mode preview column visibility (FR-3.3, Ctrl+Shift+P). */
  rawPreviewVisible: boolean;
  toggleRawPreview: () => void;

  /** Persisted splitter ratios (FR-2.3/FR-2.4). */
  rawSplit: number;
  setRawSplit: (ratio: number) => void;
  dualSplit: number;
  setDualSplit: (ratio: number) => void;

  /** Cursor position for the status bar (FR-10.3); not persisted. */
  cursor: { line: number; col: number } | null;
  setCursor: (cursor: { line: number; col: number } | null) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: 'wysiwyg',
      setMode: (mode) => set({ mode }),

      rawPreviewVisible: true,
      toggleRawPreview: () => set((s) => ({ rawPreviewVisible: !s.rawPreviewVisible })),

      rawSplit: 0.5,
      setRawSplit: (rawSplit) => set({ rawSplit }),
      dualSplit: 0.5,
      setDualSplit: (dualSplit) => set({ dualSplit }),

      cursor: null,
      setCursor: (cursor) => set({ cursor }),
    }),
    {
      name: 'markyou.ui',
      partialize: (state) => ({
        mode: state.mode,
        rawPreviewVisible: state.rawPreviewVisible,
        rawSplit: state.rawSplit,
        dualSplit: state.dualSplit,
      }),
    },
  ),
);
