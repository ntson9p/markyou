import { Suspense, lazy, useEffect } from 'react';

import { EditorArea } from '@/app/EditorArea';
import { Notices } from '@/app/Notices';
import { StatusBar } from '@/app/StatusBar';
import { TopBar } from '@/app/TopBar';
import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore, type EditorMode } from '@/app/store/ui';
import { useDocStore } from '@/core/document/store';
import { newDocument, openDocument, saveDocument, saveDocumentAs } from '@/features/files/actions';
import { startDraftGuard } from '@/features/files/drafts';
import { useFileDrop } from '@/features/files/useFileDrop';
import { WelcomeScreen } from '@/features/files/WelcomeScreen';
import { DiagramEditorModal } from '@/features/diagram/DiagramEditorModal';
import { ExportPanel } from '@/features/export/ExportPanel';
import { ShortcutsPanel } from '@/features/help/ShortcutsPanel';
import { MetadataPanel } from '@/features/metadata/MetadataPanel';
import { Outline } from '@/features/outline/Outline';
import { SettingsPanel } from '@/features/settings/SettingsPanel';
import { useSettingsStore } from '@/features/settings/store';
import { HistoryPanel } from '@/features/snapshots/HistoryPanel';
import { startSnapshotScheduler } from '@/features/snapshots/snapshots';

// Lazy like the editor engines (initial-JS budget §7): @codemirror/merge and
// the diff wiring load on first open, not at boot.
const DiffOverlay = lazy(() =>
  import('@/features/diff/DiffOverlay').then((m) => ({ default: m.DiffOverlay })),
);

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
      // Review changes overlay: Ctrl+Shift+D toggles the diff of unsaved edits.
      if (e.code === 'KeyD' && e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (useDocStore.getState().status !== 'open') return;
        const ui = useUiStore.getState();
        ui.setActivePanel(ui.activePanel === 'diff' ? null : 'diff');
        return;
      }
      // Keyboard-shortcuts sheet (§8.3): Ctrl+/
      if (e.code === 'Slash' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const cur = useUiStore.getState().activePanel;
        useUiStore.getState().setActivePanel(cur === 'shortcuts' ? null : 'shortcuts');
        return;
      }
      // Settings (FR-13): Ctrl+, the near-universal convention.
      if (e.code === 'Comma' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const cur = useUiStore.getState().activePanel;
        useUiStore.getState().setActivePanel(cur === 'settings' ? null : 'settings');
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

/**
 * Track the visual viewport (§8.2): when the mobile virtual keyboard opens,
 * the layout viewport doesn't shrink, so pin the shell to `visualViewport`
 * height to keep the status bar and toolbar above the keyboard.
 */
function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--app-height', `${vv.height}px`);
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--app-height');
    };
  }, []);
}

/**
 * Publish the diagram-scroll preference to the document root, where the
 * stylesheets read it (FR-5.9). Held in CSS rather than applied per diagram so
 * toggling it takes effect on every diagram at once, with nothing to re-render
 * and no already-rendered SVG left carrying a stale inline width.
 */
function useDiagramScrollPref() {
  const on = useSettingsStore((s) => s.diagramScroll);
  useEffect(() => {
    document.documentElement.dataset.diagramScroll = on ? 'on' : 'off';
  }, [on]);
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
  const diffOpen = useUiStore((s) => s.activePanel === 'diff');
  const isSmall = useIsSmallScreen();

  useGlobalShortcuts();
  useLeaveWarning();
  useVisualViewportHeight();
  useDiagramScrollPref();
  useFileDrop();
  useEffect(() => startDraftGuard(), []);
  useEffect(() => startSnapshotScheduler(), []);

  return (
    <div className="flex flex-col" style={{ height: isSmall ? 'var(--app-height, 100%)' : '100%' }}>
      <TopBar />
      <main className="relative flex min-h-0 flex-1" aria-label="Editor area">
        {status === 'open' ? (
          <>
            {outlineVisible && <Outline drawer={isSmall} />}
            {/* `min-w-0` guards the main axis: `main` is a row, so a flex
                item's automatic minimum is its *min-content width*. Without
                it, one block that is intrinsically wide — a long code line, a
                large diagram — stretches this pane past the window and pushes
                the page off-screen, leaving only the backdrop in view. */}
            <div className="min-h-0 min-w-0 flex-1">
              <EditorArea />
            </div>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </main>
      <StatusBar />
      <Notices />
      <MetadataPanel />
      <ExportPanel />
      <HistoryPanel />
      <ShortcutsPanel />
      <SettingsPanel />
      <DiagramEditorModal />
      {diffOpen && (
        <Suspense fallback={null}>
          <DiffOverlay />
        </Suspense>
      )}
    </div>
  );
}
