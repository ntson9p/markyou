import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';

import { diffToChanges } from '@/editors/raw/diff-apply';

function apply(oldText: string, newText: string): string {
  const state = EditorState.create({ doc: oldText });
  return state.update({ changes: diffToChanges(oldText, newText) }).state.doc.toString();
}

describe('diffToChanges (plan §2.2 minimal diff)', () => {
  const cases: [string, string][] = [
    ['hello world', 'hello brave world'],
    ['abc', 'abc'],
    ['', 'new content'],
    ['old content', ''],
    ['line1\nline2\nline3', 'line1\nLINE2\nline3'],
    ['aaa bbb ccc', 'aaa ccc'],
    ['x', 'a very much longer replacement text'],
    ['# Title\n\npara', '# Title!\n\npara two'],
  ];

  for (const [oldText, newText] of cases) {
    it(`transforms ${JSON.stringify(oldText)} → ${JSON.stringify(newText)}`, () => {
      expect(apply(oldText, newText)).toBe(newText);
    });
  }

  it('returns no changes for identical text', () => {
    expect(diffToChanges('same', 'same')).toEqual([]);
  });

  it('produces a minimal edit for a small insertion in a large doc', () => {
    const big = 'x'.repeat(10000) + 'MIDDLE' + 'y'.repeat(10000);
    const changed = 'x'.repeat(10000) + 'MIDDLE!' + 'y'.repeat(10000);
    const changes = diffToChanges(big, changed);
    expect(changes.length).toBe(1);
  });
});
