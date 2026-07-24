import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

import { useUiStore } from '@/app/store/ui';

// Editor engines are lazy chunks (initial-JS budget §7); the service worker
// precaches them, so offline use and mode switches stay instant.
const RawMode = lazy(() => import('@/app/RawMode').then((m) => ({ default: m.RawMode })));
const WysiwygMode = lazy(() =>
  import('@/app/WysiwygMode').then((m) => ({ default: m.WysiwygMode })),
);
const DualMode = lazy(() => import('@/app/DualMode').then((m) => ({ default: m.DualMode })));

function PaneLoader() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-label="Loading editor" />
    </div>
  );
}

/** The pane region, switched by mode (FR-2.1). */
export function EditorArea() {
  const mode = useUiStore((s) => s.mode);

  const pane = mode === 'raw' ? <RawMode /> : mode === 'wysiwyg' ? <WysiwygMode /> : <DualMode />;

  return <Suspense fallback={<PaneLoader />}>{pane}</Suspense>;
}
