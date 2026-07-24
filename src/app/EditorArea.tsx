import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

import { useUiStore } from '@/app/store/ui';
import { TextareaEditor } from '@/editors/placeholder/TextareaEditor';

// Editor engines are lazy chunks (initial-JS budget §7); the service worker
// precaches them, so offline use and mode switches stay instant.
const RawMode = lazy(() => import('@/app/RawMode').then((m) => ({ default: m.RawMode })));
const WysiwygMode = lazy(() =>
  import('@/app/WysiwygMode').then((m) => ({ default: m.WysiwygMode })),
);

function PaneLoader() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-label="Loading editor" />
    </div>
  );
}

/**
 * The pane region, switched by mode (FR-2.1). The dual splitter lands in M5
 * and currently falls back to the placeholder editor.
 */
export function EditorArea() {
  const mode = useUiStore((s) => s.mode);

  if (mode === 'raw') {
    return (
      <Suspense fallback={<PaneLoader />}>
        <RawMode />
      </Suspense>
    );
  }

  if (mode === 'wysiwyg') {
    return (
      <Suspense fallback={<PaneLoader />}>
        <WysiwygMode />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-muted/40 px-4 py-1 text-center text-xs text-muted-foreground">
        Dual mode lands in M5 — placeholder editor below
      </div>
      <div className="min-h-0 flex-1">
        <TextareaEditor />
      </div>
    </div>
  );
}
