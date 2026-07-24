import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

import { EditorCrashFallback } from '@/app/ErrorFallbacks';
import { useIsSmallScreen } from '@/app/useMediaQuery';
import { useUiStore } from '@/app/store/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  const isSmall = useIsSmallScreen();

  // Dual is desktop-only (D4): a persisted 'dual' renders single-pane on
  // phones without overwriting the user's desktop preference.
  const effectiveMode = isSmall && mode === 'dual' ? 'wysiwyg' : mode;
  const pane =
    effectiveMode === 'raw' ? (
      <RawMode />
    ) : effectiveMode === 'wysiwyg' ? (
      <WysiwygMode />
    ) : (
      <DualMode />
    );

  // Key the boundary by mode so switching modes clears a crashed pane; the
  // shell (menu, save, mode switcher) keeps working around it.
  return (
    <ErrorBoundary
      key={effectiveMode}
      fallback={(error, reset) => <EditorCrashFallback error={error} reset={reset} />}
    >
      <Suspense fallback={<PaneLoader />}>{pane}</Suspense>
    </ErrorBoundary>
  );
}
