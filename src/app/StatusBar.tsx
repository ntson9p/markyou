import { useEffect, useMemo, useState } from 'react';

import { countText } from '@/core/document/counts';
import { useDocStore } from '@/core/document/store';
import { useEditorsStore } from '@/app/store/editors';
import { useUiStore } from '@/app/store/ui';

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function savedLabel(lastSavedAt: number | null, now: number): string {
  if (lastSavedAt === null) return 'Not saved yet';
  const minutes = Math.round((now - lastSavedAt) / 60_000);
  if (minutes < 1) return 'Saved · just now';
  if (minutes < 60) return `Saved · ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `Saved · ${hours} h ago`;
}

export function StatusBar() {
  const status = useDocStore((s) => s.status);
  const body = useDocStore((s) => s.body);
  const dirty = useDocStore((s) => s.dirty);
  const lastSavedAt = useDocStore((s) => s.lastSavedAt);
  const cursor = useUiStore((s) => s.cursor);
  const mode = useUiStore((s) => s.mode);
  const selectionText = useEditorsStore((s) => s.selectionText);
  const now = useNow();

  const counts = useMemo(() => countText(body), [body]);
  const selectionCounts = useMemo(
    () => (selectionText ? countText(selectionText) : null),
    [selectionText],
  );

  return (
    <footer
      className="flex h-7 shrink-0 items-center gap-4 border-t bg-background px-3 text-xs text-muted-foreground"
      aria-label="Status bar"
    >
      {status === 'open' ? (
        <>
          <span data-testid="status-counts">
            {selectionCounts ? (
              <span data-testid="status-selection-counts">
                {selectionCounts.words.toLocaleString()} words selected ·{' '}
                {selectionCounts.characters.toLocaleString()} chars
              </span>
            ) : (
              <>
                {counts.words.toLocaleString()} words · {counts.readingMinutes} min read
              </>
            )}
          </span>
          <span className="flex-1" />
          {cursor && mode !== 'wysiwyg' && (
            <span data-testid="status-cursor">
              L{cursor.line}:C{cursor.col}
            </span>
          )}
          <span data-testid="status-save">
            {dirty ? 'Unsaved changes' : savedLabel(lastSavedAt, now)}
          </span>
        </>
      ) : (
        <>
          <span className="flex-1" />
          <span data-testid="status-save">No document open</span>
        </>
      )}
    </footer>
  );
}
