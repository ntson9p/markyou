export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

/** Guard against O(n·m) blowup on huge documents. */
const MAX_DP_CELLS = 4_000_000;

/**
 * Simple LCS-based line diff for the recovery preview (FR-1.7) —
 * good enough for a readable preview; the full merge view (M6) uses
 * @codemirror/merge.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) {
    return oldText === ''
      ? []
      : oldText.split('\n').map((text) => ({ type: 'same' as const, text }));
  }
  const a = oldText.split('\n');
  const b = newText.split('\n');

  // Trim common prefix/suffix.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const result: DiffLine[] = [];
  for (let i = 0; i < start; i++) result.push({ type: 'same', text: a[i] });

  if (midA.length * midB.length > MAX_DP_CELLS) {
    // Too large for exact diff: mark the whole middle as replaced.
    for (const text of midA) result.push({ type: 'del', text });
    for (const text of midB) result.push({ type: 'add', text });
  } else {
    result.push(...lcsDiff(midA, midB));
  }

  for (let i = endA; i < a.length; i++) result.push({ type: 'same', text: a[i] });
  return result;
}

function lcsDiff(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:], b[j:]
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i] });
      i++;
    } else {
      out.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i++] });
  while (j < m) out.push({ type: 'add', text: b[j++] });
  return out;
}

/** Compact a diff to changed hunks with `context` lines around them (for previews). */
export function diffHunks(lines: DiffLine[], context = 2): { lines: DiffLine[]; skipped: boolean } {
  const keep = new Array<boolean>(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.type !== 'same') {
      for (
        let k = Math.max(0, idx - context);
        k <= Math.min(lines.length - 1, idx + context);
        k++
      ) {
        keep[k] = true;
      }
    }
  });
  const out: DiffLine[] = [];
  let skipped = false;
  let inGap = false;
  lines.forEach((l, idx) => {
    if (keep[idx]) {
      out.push(l);
      inGap = false;
    } else {
      skipped = true;
      if (!inGap) {
        out.push({ type: 'same', text: '⋯' });
        inGap = true;
      }
    }
  });
  return { lines: out, skipped };
}
