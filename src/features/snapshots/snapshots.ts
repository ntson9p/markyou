import { db, type SnapshotRecord } from '@/core/storage/db';
import { getFullText, useDocStore } from '@/core/document/store';

/** FR-12.1: auto-snapshot cadence while the document is dirty. */
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const KEEP_VERBATIM = 50;
const CAP_PER_DOC = 200;
const THIN_BUCKET_MS = 60 * 60 * 1000; // older snapshots: keep ~1 per hour

/** Snapshots for a document, newest first. */
export async function listSnapshots(docId: string): Promise<SnapshotRecord[]> {
  if (!docId) return [];
  const rows = await db.snapshots.where('docId').equals(docId).sortBy('createdAt');
  return rows.reverse();
}

/**
 * Record a version snapshot (FR-12.1), skipping no-op duplicates, then apply
 * retention: newest 50 verbatim, older thinned to ~1/hour, capped at 200/doc.
 */
export async function takeSnapshot(
  docId: string,
  text: string,
  trigger: SnapshotRecord['trigger'],
): Promise<void> {
  if (!docId) return;
  try {
    const latest = await db.snapshots.where('docId').equals(docId).last();
    if (latest && latest.text === text) return; // nothing changed
    await db.snapshots.add({ docId, text, createdAt: Date.now(), trigger });
    await prune(docId);
  } catch (e) {
    console.error('Snapshot failed', e);
  }
}

async function prune(docId: string): Promise<void> {
  const all = await listSnapshots(docId); // newest first
  if (all.length <= KEEP_VERBATIM) return;

  const keep = new Set<number>();
  all.slice(0, KEEP_VERBATIM).forEach((s) => s.id != null && keep.add(s.id));

  const seen = new Set<number>();
  for (const s of all.slice(KEEP_VERBATIM)) {
    const bucket = Math.floor(s.createdAt / THIN_BUCKET_MS);
    if (!seen.has(bucket) && s.id != null) {
      seen.add(bucket);
      keep.add(s.id);
    }
  }

  // Cap: keep the newest 200 of the retained set.
  const kept = all.filter((s) => s.id != null && keep.has(s.id)).slice(0, CAP_PER_DOC);
  const keptIds = new Set(kept.map((s) => s.id));
  const remove = all.filter((s) => s.id != null && !keptIds.has(s.id)).map((s) => s.id!);
  if (remove.length) await db.snapshots.bulkDelete(remove);
}

/**
 * Snapshot scheduler (FR-12.1): a 'save' snapshot on each clean save and an
 * 'auto' snapshot every 5 minutes while dirty. Mirrors the draft guard.
 */
export function startSnapshotScheduler(intervalMs = SNAPSHOT_INTERVAL_MS) {
  const interval = setInterval(() => {
    const s = useDocStore.getState();
    if (s.status === 'open' && s.dirty) void takeSnapshot(s.docId, getFullText(s), 'auto');
  }, intervalMs);

  const unsubscribe = useDocStore.subscribe((state, prev) => {
    if (prev.dirty && !state.dirty && state.status === 'open') {
      void takeSnapshot(state.docId, getFullText(state), 'save');
    }
  });

  return () => {
    clearInterval(interval);
    unsubscribe();
  };
}
