import { useEffect, useState } from 'react';
import { FilePlus2, FolderOpen, FileText, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DraftRecord, RecentRecord } from '@/core/storage/db';
import { newDocument, openDocument, openRecent } from '@/features/files/actions';
import { listRecents } from '@/features/files/recents';
import { RecoveryBanner } from '@/features/files/RecoveryBanner';
import { discardDraft, findRecoveryCandidate, restoreDraft } from '@/features/files/recovery';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function WelcomeScreen() {
  const [recents, setRecents] = useState<RecentRecord[]>([]);
  const [draft, setDraft] = useState<DraftRecord | null>(null);

  useEffect(() => {
    void listRecents().then(setRecents);
    void findRecoveryCandidate().then(setDraft);
  }, []);

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-surface p-6">
      <div className="mt-[8vh] flex w-full max-w-lg flex-col gap-4">
        {draft && (
          <RecoveryBanner
            draft={draft}
            onRestore={() => {
              restoreDraft(draft);
              setDraft(null);
            }}
            onDiscard={() => {
              void discardDraft(draft);
              setDraft(null);
            }}
          />
        )}

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
            <div>
              <h1 className="text-lg font-semibold">MarkYou</h1>
              <p className="text-sm text-muted-foreground">
                Local-first markdown editing — raw, rich, or both.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={newDocument} data-testid="welcome-new">
              <FilePlus2 className="size-4" /> New document
            </Button>
            <Button
              variant="outline"
              onClick={() => void openDocument()}
              data-testid="welcome-open"
            >
              <FolderOpen className="size-4" /> Open…
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: drag a .md file anywhere in this window to open it.
          </p>
        </div>

        {recents.length > 0 && (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent files
            </h2>
            <ul className="mt-1" data-testid="recents-list">
              {recents.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60 outline-none"
                    onClick={() => void openRecent(r.handle)}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.pathHint}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" aria-hidden />
                      {relativeTime(r.lastOpenedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
