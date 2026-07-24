import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The three editing modes (FR-2.1). */
export type EditorMode = 'raw' | 'wysiwyg' | 'dual';

interface UiState {
  /** Default is WYSIWYG (D3); last-used mode persists per device (FR-2.3). */
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: 'wysiwyg',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'markyou.ui',
      partialize: (state) => ({ mode: state.mode }),
    },
  ),
);
