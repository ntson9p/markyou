import { useMemo, useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { diffHunks, diffLines } from '@/lib/line-diff';
import type { DraftRecord } from '@/core/storage/db';

interface RecoveryBannerProps {
  draft: DraftRecord;
  onRestore: () => void;
  onDiscard: () => void;
}

/** FR-1.7: recovery banner with Restore / Discard and a preview diff. */
export function RecoveryBanner({ draft, onRestore, onDiscard }: RecoveryBannerProps) {
  const [showDiff, setShowDiff] = useState(false);
  const when = new Date(draft.updatedAt).toLocaleString();
  const label = draft.fileName ? `“${draft.fileName}”` : 'an untitled document';

  const preview = useMemo(() => {
    if (!showDiff) return null;
    return diffHunks(diffLines(draft.baseText ?? '', draft.text), 2);
  }, [showDiff, draft]);

  return (
    <div
      role="region"
      aria-label="Draft recovery"
      className="w-full rounded-lg border border-primary/40 bg-card p-4 shadow-sm"
      data-testid="recovery-banner"
    >
      <div className="flex items-start gap-3">
        <History className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Unsaved changes recovered</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A draft of {label} from {when} is newer than the last save.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onRestore} data-testid="recovery-restore">
          Restore draft
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscard} data-testid="recovery-discard">
          Discard
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowDiff((v) => !v)}
          aria-expanded={showDiff}
        >
          {showDiff ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {showDiff ? 'Hide changes' : 'Preview changes'}
        </Button>
      </div>
      {preview && (
        <pre
          className="mt-3 max-h-56 overflow-auto rounded-md border bg-surface p-2 font-mono text-xs leading-5"
          aria-label="Draft changes preview"
        >
          {preview.lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'px-1 whitespace-pre-wrap',
                line.type === 'add' && 'bg-green-500/15 text-green-700 dark:text-green-400',
                line.type === 'del' && 'bg-red-500/15 text-red-700 dark:text-red-400 line-through',
              )}
            >
              {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
              {line.text}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}
