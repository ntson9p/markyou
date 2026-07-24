import { useEffect } from 'react';
import { FileText } from 'lucide-react';

import { StatusBar } from '@/app/StatusBar';
import { TopBar } from '@/app/TopBar';
import { useUiStore, type EditorMode } from '@/app/store/ui';

const MODE_SHORTCUTS: Record<string, EditorMode> = {
  Digit1: 'raw',
  Digit2: 'wysiwyg',
  Digit3: 'dual',
};

function useModeShortcuts() {
  const setMode = useUiStore((s) => s.setMode);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
        const mode = MODE_SHORTCUTS[e.code];
        if (mode) {
          e.preventDefault();
          setMode(mode);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setMode]);
}

function PanePlaceholder() {
  const mode = useUiStore((s) => s.mode);
  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-center">
        <FileText className="size-10 text-muted-foreground/50" aria-hidden />
        <div>
          <p className="text-sm font-medium">MarkYou</p>
          <p className="text-sm text-muted-foreground">
            Editor coming in the next milestones · current mode:{' '}
            <span data-testid="active-mode">{mode}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  useModeShortcuts();

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="min-h-0 flex-1" aria-label="Editor area">
        <PanePlaceholder />
      </main>
      <StatusBar />
    </div>
  );
}
