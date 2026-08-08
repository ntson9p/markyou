import { useEffect, useState } from 'react';

import { getFullText, useDocStore } from '@/core/document/store';
import { diffLines } from '@/lib/line-diff';

/** Idle delay before recomputing stats while typing (status-bar chip, diff header). */
const STATS_DEBOUNCE_MS = 400;

export interface DiffStats {
  /** Lines present only in the current text. */
  added: number;
  /** Lines present only in the saved text. */
  removed: number;
  /** Contiguous changed blocks (≈ the merge view's chunks). */
  blocks: number;
}

/** Line-level change stats between two texts (Review Changes design §entry-points). */
export function computeDiffStats(oldText: string, newText: string): DiffStats {
  if (oldText === newText) return { added: 0, removed: 0, blocks: 0 };
  // Against the empty file (never-saved doc) everything is an addition — the
  // line diff would otherwise report the empty line as also "removed".
  if (oldText === '') return { added: newText.split('\n').length, removed: 0, blocks: 1 };
  if (newText === '') return { added: 0, removed: oldText.split('\n').length, blocks: 1 };
  let added = 0;
  let removed = 0;
  let blocks = 0;
  let inBlock = false;
  for (const line of diffLines(oldText, newText)) {
    if (line.type === 'same') {
      inBlock = false;
      continue;
    }
    if (line.type === 'add') added++;
    else removed++;
    if (!inBlock) {
      blocks++;
      inBlock = true;
    }
  }
  return { added, removed, blocks };
}

/**
 * Debounced stats for the open document vs. its last saved version; null while
 * the document is clean or closed (the chip and header hide the numbers). A
 * never-saved document diffs against the empty file, so everything counts as
 * added — matching what the overlay shows.
 */
export function useDiffStats(): DiffStats | null {
  const status = useDocStore((s) => s.status);
  const dirty = useDocStore((s) => s.dirty);
  const version = useDocStore((s) => s.version);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const eligible = status === 'open' && dirty;

  useEffect(() => {
    if (!eligible) return;
    const timer = window.setTimeout(() => {
      const s = useDocStore.getState();
      setStats(computeDiffStats(s.savedText ?? '', getFullText(s)));
    }, STATS_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [eligible, version]);

  // Derived, not reset-in-effect: while clean the numbers hide; a re-dirtied
  // document may show the previous numbers for one debounce interval at most.
  return eligible ? stats : null;
}
