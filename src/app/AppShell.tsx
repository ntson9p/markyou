import { useEffect } from 'react';

import { EditorArea } from '@/app/EditorArea';
import { Notices } from '@/app/Notices';
import { StatusBar } from '@/app/StatusBar';
import { TopBar } from '@/app/TopBar';
import { useUiStore, type EditorMode } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';
import { newDocument, openDocument, saveDocument, saveDocumentAs } from '@/features/files/actions';
import { startDraftGuard } from '@/features/files/drafts';
import { useFileDrop } from '@/features/files/useFileDrop';
import { WelcomeScreen } from '@/features/files/WelcomeScreen';
import { Outline } from '@/features/outline/Outline';

const MODE_SHORTCUTS: Record<string, EditorMode> = {
  Digit1: 'raw',
  Digit2: 'wysiwyg',
  Digit3: 'dual',
};

function useGlobalShortcuts() {
  const setMode = useUiStore((s) => s.setMode);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Mode switching: Ctrl+Shift+1/2/3 (FR-2.1)
      if (e.shiftKey && !e.altKey && MODE_SHORTCUTS[e.code]) {
        e.preventDefault();
        setMode(MODE_SHORTCUTS[e.code]);
        return;
      }
      // Toggle preview in raw mode (FR-3.3)
      if (e.code === 'KeyP' && e.shiftKey && !e.altKey) {
        e.preventDefault();
        useUiStore.getState().toggleRawPreview();
        return;
      }
      // Toggle outline sidebar (FR-10.1)
      if (e.code === 'KeyO' && e.shiftKey && !e.altKey) {
        e.preventDefault();
        useUiStore.getState().toggleOutline();
        return;
      }
      // File lifecycle (§8.3)
      if (e.code === 'KeyS' && !e.altKey) {
        e.preventDefault();
        if (e.shiftKey) void saveDocumentAs();
        else void saveDocument();
        return;
      }
      if (e.code === 'KeyO' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void openDocument();
        return;
      }
      if (e.code === 'KeyN' && e.altKey && !e.shiftKey) {
        e.preventDefault();
        newDocument();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setMode]);
}

/** FR-1.6: closing the tab with unsaved changes triggers the leave-warning. */
function useLeaveWarning() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useDocStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}

export function AppShell() {
  const status = useDocStore((s) => s.status);
  const outlineVisible = useUiStore((s) => s.outlineVisible);

  useGlobalShortcuts();
  useLeaveWarning();
  useFileDrop();
  useEffect(() => startDraftGuard(), []);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex min-h-0 flex-1" aria-label="Editor area">
        {status === 'open' ? (
          <>
            {outlineVisible && <Outline />}
            <div className="min-h-0 flex-1">
              <EditorArea />
            </div>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </main>
      <StatusBar />
      <Notices />
    </div>
  );
}
