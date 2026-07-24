import { useEffect, useState } from 'react';

import { useUiStore } from '@/app/store/ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { getFullText, useDocStore } from '@/core/document/store';
import type { SnapshotRecord } from '@/core/storage/db';
import { cn } from '@/lib/utils';

import { DiffView } from './DiffView';
import { listSnapshots, takeSnapshot } from './snapshots';

const TRIGGER_LABELS: Record<SnapshotRecord['trigger'], string> = {
  save: 'Saved',
  auto: 'Auto-saved',
  restore: 'Restore point',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel() {
  const open = useUiStore((s) => s.activePanel === 'history');
  return open ? <HistoryDialog /> : null;
}

function HistoryDialog() {
  const close = () => useUiStore.getState().setActivePanel(null);
  const docId = useDocStore((s) => s.docId);
  const body = useDocStore((s) => s.body);
  const frontmatter = useDocStore((s) => s.frontmatter);
  const currentText = getFullText({ body, frontmatter });

  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void listSnapshots(docId).then((rows) => {
      if (!alive) return;
      setSnapshots(rows);
      setSelectedId(rows[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [docId]);

  const selected = snapshots.find((s) => s.id === selectedId) ?? null;

  const restore = async () => {
    if (!selected) return;
    const store = useDocStore.getState();
    // Snapshot the current state first so a restore is itself undoable (FR-12.3).
    await takeSnapshot(store.docId, getFullText(store), 'restore');
    store.restoreText(selected.text);
    close();
  };

  return (
    <Modal
      open
      onClose={close}
      title="Version history"
      description="Snapshots are captured on save and every 5 minutes while editing."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close}>
            Close
          </Button>
          <Button size="sm" disabled={!selected} onClick={restore} data-testid="history-restore">
            Restore this version
          </Button>
        </>
      }
    >
      <div className="grid min-h-[45vh] grid-cols-[minmax(11rem,15rem)_1fr] gap-3">
        <ul
          className="space-y-1 overflow-y-auto border-r border-border pr-2"
          data-testid="history-list"
        >
          {snapshots.length === 0 && (
            <li className="px-1 py-2 text-xs text-muted-foreground">
              No versions yet. They appear after your first save.
            </li>
          )}
          {snapshots.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id ?? null)}
                data-active={s.id === selectedId}
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-sm',
                  s.id === selectedId ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                <span className="block">{formatTime(s.createdAt)}</span>
                <span className="block text-xs text-muted-foreground">
                  {TRIGGER_LABELS[s.trigger]}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0">
          {selected ? (
            <DiffView oldText={selected.text} newText={currentText} />
          ) : (
            <p className="text-xs text-muted-foreground">Select a version to see what changed.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
