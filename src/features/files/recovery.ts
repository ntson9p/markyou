import { db, type DraftRecord } from '@/core/storage/db';
import { normalizeEol, useDocStore } from '@/core/document/store';
import type { FileBinding } from '@/core/document/store';

/**
 * Boot-time recovery check (FR-1.7): find the most recent draft. If the
 * original file is silently readable and matches the draft, the draft is
 * obsolete and gets cleaned up. Otherwise it is offered for recovery.
 */
export async function findRecoveryCandidate(): Promise<DraftRecord | null> {
  let draft: DraftRecord | undefined;
  try {
    draft = await db.drafts.orderBy('updatedAt').reverse().first();
  } catch {
    return null;
  }
  if (!draft) return null;

  if (draft.handle) {
    try {
      if ((await draft.handle.queryPermission({ mode: 'read' })) === 'granted') {
        const file = await draft.handle.getFile();
        const fileText = await file.text();
        // Drafts are LF-canonical; the file may be CRLF — compare like for like.
        if (normalizeEol(fileText) === normalizeEol(draft.text)) {
          await db.drafts.delete(draft.docId);
          return null;
        }
        // The file's current content is the best diff base.
        return { ...draft, baseText: fileText };
      }
    } catch {
      // Permission/read failure — fall through and offer the draft as-is.
    }
  }
  return draft;
}

/** Restore a draft into the document store (keeps guarding under the same docId). */
export function restoreDraft(draft: DraftRecord) {
  const file: FileBinding | null = draft.handle
    ? {
        kind: 'fsa',
        name: draft.fileName ?? draft.handle.name,
        handle: draft.handle,
        canSaveInPlace: true,
      }
    : draft.fileName
      ? { kind: 'memory', name: draft.fileName, canSaveInPlace: false }
      : null;

  useDocStore.getState().openDocument({
    text: draft.text,
    file,
    dirty: true,
    docId: draft.docId,
    savedText: draft.baseText,
  });
}

export async function discardDraft(draft: DraftRecord): Promise<void> {
  await db.drafts.delete(draft.docId);
}
