import { describe, expect, it } from 'vitest';

import { diffHunks, diffLines } from '@/lib/line-diff';

describe('diffLines', () => {
  it('returns all-same for identical text', () => {
    const d = diffLines('a\nb', 'a\nb');
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ]);
  });

  it('detects additions', () => {
    const d = diffLines('a\nc', 'a\nb\nc');
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('detects deletions', () => {
    const d = diffLines('a\nb\nc', 'a\nc');
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('detects replacements', () => {
    const d = diffLines('hello world', 'goodbye world');
    expect(d).toContainEqual({ type: 'del', text: 'hello world' });
    expect(d).toContainEqual({ type: 'add', text: 'goodbye world' });
  });

  it('handles empty old text (never-saved doc)', () => {
    const d = diffLines('', 'new\ncontent');
    expect(d.filter((l) => l.type === 'add')).toHaveLength(2);
  });

  it('survives very large inputs via the fallback path', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n');
    const b = Array.from({ length: 5000 }, (_, i) => `LINE ${i}`).join('\n');
    const d = diffLines(a, b);
    expect(d.length).toBeGreaterThan(0);
  });

  it('is line-break-flavor insensitive: CRLF vs LF differs only where content differs', () => {
    const d = diffLines('a\r\nb\r\nc\r\n', 'a\nB\nc\n');
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'B' },
      { type: 'same', text: 'c' },
      { type: 'same', text: '' },
    ]);
  });
});

describe('diffHunks', () => {
  it('collapses long unchanged runs', () => {
    const lines = diffLines(
      Array.from({ length: 50 }, (_, i) => `l${i}`).join('\n'),
      Array.from({ length: 50 }, (_, i) => (i === 25 ? 'CHANGED' : `l${i}`)).join('\n'),
    );
    const { lines: hunks, skipped } = diffHunks(lines, 2);
    expect(skipped).toBe(true);
    expect(hunks.length).toBeLessThan(lines.length);
    expect(hunks.some((l) => l.text === 'CHANGED')).toBe(true);
  });
});
