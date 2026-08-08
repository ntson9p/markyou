import { describe, expect, it } from 'vitest';

import { computeDiffStats } from '@/features/diff/stats';

describe('computeDiffStats', () => {
  it('returns zeros for identical text', () => {
    expect(computeDiffStats('a\nb', 'a\nb')).toEqual({ added: 0, removed: 0, blocks: 0 });
  });

  it('counts added lines as one block', () => {
    expect(computeDiffStats('a\nc', 'a\nb\nc')).toEqual({ added: 1, removed: 0, blocks: 1 });
  });

  it('counts removed lines as one block', () => {
    expect(computeDiffStats('a\nb\nc', 'a\nc')).toEqual({ added: 0, removed: 1, blocks: 1 });
  });

  it('a modified line counts both sides in a single block', () => {
    expect(computeDiffStats('a\nb\nc', 'a\nB\nc')).toEqual({ added: 1, removed: 1, blocks: 1 });
  });

  it('separated edits count as separate blocks', () => {
    expect(computeDiffStats('a\nb\nc\nd\ne', 'a\nB\nc\nd\nE')).toEqual({
      added: 2,
      removed: 2,
      blocks: 2,
    });
  });

  it('a never-saved document is all additions against the empty file', () => {
    expect(computeDiffStats('', '# Hi\n\ntext')).toEqual({ added: 3, removed: 0, blocks: 1 });
  });

  it('clearing the document is all removals', () => {
    expect(computeDiffStats('a\nb', '')).toEqual({ added: 0, removed: 2, blocks: 1 });
  });
});
