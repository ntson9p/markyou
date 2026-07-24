import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_STYLE_PREFS, type MarkdownStylePrefs } from '@/core/markdown/style';
import type { EditorMode } from '@/app/store/ui';

/** User settings (FR-13). The dialog UI arrives in M6; the store is live now. */
interface SettingsState {
  /** Drives D13 normalization (FR-13.2). */
  markdownStyle: MarkdownStylePrefs;
  /** Editor preferences (FR-13.3). */
  fontSize: number;
  lineNumbers: boolean;
  defaultMode: EditorMode;
  draftIntervalMs: number;

  setMarkdownStyle: (patch: Partial<MarkdownStylePrefs>) => void;
  setFontSize: (px: number) => void;
  setLineNumbers: (on: boolean) => void;
  setDefaultMode: (mode: EditorMode) => void;
  setDraftIntervalMs: (ms: number) => void;
  resetToDefaults: () => void;
}

const DEFAULTS = {
  markdownStyle: DEFAULT_STYLE_PREFS,
  fontSize: 14,
  lineNumbers: true,
  defaultMode: 'wysiwyg' as EditorMode,
  draftIntervalMs: 1000,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setMarkdownStyle: (patch) =>
        set((s) => ({ markdownStyle: { ...s.markdownStyle, ...patch } })),
      setFontSize: (fontSize) => set({ fontSize }),
      setLineNumbers: (lineNumbers) => set({ lineNumbers }),
      setDefaultMode: (defaultMode) => set({ defaultMode }),
      setDraftIntervalMs: (draftIntervalMs) => set({ draftIntervalMs }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: 'markyou.settings' },
  ),
);
