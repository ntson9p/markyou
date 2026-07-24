import { db, type RecentRecord } from '@/core/storage/db';
import type { FileBinding } from '@/core/document/store';

const MAX_RECENTS = 10;

/** Add or refresh a recent-files entry (FR-1.5). */
export async function addRecent(binding: FileBinding): Promise<void> {
  const now = Date.now();
  try {
    const existing = await db.recents.toArray();
    // Dedupe: by handle identity when possible, else by name.
    let match: RecentRecord | undefined;
    for (const r of existing) {
      if (binding.handle && r.handle) {
        try {
          if (await binding.handle.isSameEntry(r.handle)) {
            match = r;
            break;
          }
        } catch {
          // ignore and fall through to name comparison
        }
      }
      if (!match && r.name === binding.name && !!r.handle === !!binding.handle) {
        match = r;
      }
    }

    const record: RecentRecord = {
      id: match?.id ?? crypto.randomUUID(),
      name: binding.name,
      pathHint: binding.kind === 'fsa' ? 'Local file' : 'Opened via upload',
      lastOpenedAt: now,
      handle: binding.handle,
    };
    try {
      await db.recents.put(record);
    } catch {
      // Handles are not structured-cloneable everywhere — retry without.
      const { handle: _handle, ...rest } = record;
      await db.recents.put(rest);
    }

    // Trim to the newest MAX_RECENTS.
    const count = await db.recents.count();
    if (count > MAX_RECENTS) {
      const stale = await db.recents
        .orderBy('lastOpenedAt')
        .limit(count - MAX_RECENTS)
        .toArray();
      await db.recents.bulkDelete(stale.map((r) => r.id));
    }
  } catch {
    // Recents are convenience data — never block a file operation on them.
  }
}

export async function listRecents(limit = 8): Promise<RecentRecord[]> {
  try {
    return await db.recents.orderBy('lastOpenedAt').reverse().limit(limit).toArray();
  } catch {
    return [];
  }
}
