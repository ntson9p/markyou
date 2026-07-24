import { db, type DraftRecord } from '@/core/storage/db';
import { getFullText, useDocStore, type DocState } from '@/core/document/store';
import { notify } from '@/app/store/notices';

/** FR-1.7 / D15: every change persisted within 1 s of idle. */
export const DRAFT_INTERVAL_MS = 1000;

const MAX_DRAFTS_KEPT = 5;

export interface DraftGuardIO {
  writeDraft: (draft: DraftRecord) => Promise<void>;
  deleteDraft: (docId: string) => Promise<void>;
}

async function writeDraftToDb(draft: DraftRecord): Promise<void> {
  try {
    await db.drafts.put(draft);
  } catch (e) {
    // Handles are not structured-cloneable everywhere — retry without.
    if (draft.handle) {
      const { handle: _handle, ...rest } = draft;
      await db.drafts.put(rest);
    } else {
      throw e;
    }
  }
  // Housekeeping: keep only the newest few drafts.
  const count = await db.drafts.count();
  if (count > MAX_DRAFTS_KEPT) {
    const stale = await db.drafts
      .orderBy('updatedAt')
      .limit(count - MAX_DRAFTS_KEPT)
      .toArray();
    await db.drafts.bulkDelete(stale.map((d) => d.docId));
  }
}

const defaultIO: DraftGuardIO = {
  writeDraft: writeDraftToDb,
  deleteDraft: (docId) => db.drafts.delete(docId),
};

export function draftFromState(state: DocState): DraftRecord {
  return {
    docId: state.docId,
    text: getFullText(state),
    updatedAt: Date.now(),
    fileName: state.file?.name ?? null,
    handle: state.file?.handle,
    baseText: state.savedText,
  };
}

/**
 * Subscribe to the document store and continuously persist a draft to
 * IndexedDB. Writes are scheduled `intervalMs` after the first unflushed
 * change, so under continuous typing the draft is never more than
 * `intervalMs` behind (§7 reliability: power loss bounded by 1 s).
 */
export function startDraftGuard(io: DraftGuardIO = defaultIO, intervalMs = DRAFT_INTERVAL_MS) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let storageErrorNotified = false;

  const flush = async () => {
    timer = null;
    const state = useDocStore.getState();
    if (state.status !== 'open' || !state.dirty) return;
    try {
      await io.writeDraft(draftFromState(state));
    } catch {
      if (!storageErrorNotified) {
        storageErrorNotified = true;
        notify(
          'error',
          'Draft autosave to browser storage is failing (storage may be full). Save your work to a file.',
        );
      }
    }
  };

  const unsubscribe = useDocStore.subscribe((state, prev) => {
    // Content change while open and dirty → schedule a draft write.
    if (state.status === 'open' && state.dirty && state.version !== prev.version) {
      timer ??= setTimeout(flush, intervalMs);
    }
    // Clean save → the draft is obsolete.
    if (prev.dirty && !state.dirty && state.docId) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      void io.deleteDraft(state.docId).catch(() => {});
    }
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
