import fastDiff from 'fast-diff';
import type { ChangeSpec } from '@codemirror/state';

/**
 * Minimal text diff → CodeMirror changes (plan §2.2 store→raw). Applying a
 * minimal diff (instead of replacing the doc) lets CM map selection and
 * scroll through the change — no cursor jumps (FR-6.1).
 */
export function diffToChanges(oldText: string, newText: string): ChangeSpec[] {
  if (oldText === newText) return [];
  const parts = fastDiff(oldText, newText);
  const changes: ChangeSpec[] = [];
  let pos = 0;
  for (const [op, text] of parts) {
    if (op === fastDiff.EQUAL) {
      pos += text.length;
    } else if (op === fastDiff.DELETE) {
      changes.push({ from: pos, to: pos + text.length });
      pos += text.length;
    } else {
      changes.push({ from: pos, insert: text });
    }
  }
  return changes;
}
