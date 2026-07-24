import { useMemo } from 'react';

import { diffHunks, diffLines } from '@/lib/line-diff';
import { cn } from '@/lib/utils';

/** Line diff between two document versions (FR-12.3), reusing the recovery diff. */
export function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const { lines } = useMemo(() => diffHunks(diffLines(oldText, newText), 2), [oldText, newText]);

  if (oldText === newText) {
    return (
      <p className="text-xs text-muted-foreground">No differences from the current document.</p>
    );
  }

  return (
    <pre
      className="max-h-[48vh] overflow-auto rounded border border-border bg-muted/30 p-2 text-xs leading-relaxed"
      aria-label="Differences from the current document"
      data-testid="history-diff"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            'whitespace-pre-wrap px-1',
            l.type === 'add' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            l.type === 'del' && 'bg-red-500/15 text-red-700 dark:text-red-300',
          )}
        >
          <span className="select-none opacity-60">
            {l.type === 'add' ? '+ ' : l.type === 'del' ? '- ' : '  '}
          </span>
          {l.text || ' '}
        </div>
      ))}
    </pre>
  );
}
