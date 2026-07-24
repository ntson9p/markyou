import { describe, expect, it } from 'vitest';

import { EMPTY_FRONTMATTER } from '@/core/document/frontmatter';
import { suggestFileName } from '@/features/files/filename';

describe('suggestFileName (FR-1.4)', () => {
  it('keeps the existing file name', () => {
    expect(
      suggestFileName({
        file: { kind: 'memory', name: 'notes.md', canSaveInPlace: false },
        frontmatter: EMPTY_FRONTMATTER,
        body: '# Other',
      }),
    ).toBe('notes.md');
  });

  it('uses the frontmatter title', () => {
    expect(
      suggestFileName({
        file: null,
        frontmatter: { ...EMPTY_FRONTMATTER, rawBlock: '---\n---\n', data: { title: 'My Post!' } },
        body: '',
      }),
    ).toBe('my-post.md');
  });

  it('falls back to the first heading', () => {
    expect(
      suggestFileName({
        file: null,
        frontmatter: EMPTY_FRONTMATTER,
        body: 'intro text\n\n## Getting Started\n',
      }),
    ).toBe('getting-started.md');
  });

  it('falls back to untitled.md', () => {
    expect(suggestFileName({ file: null, frontmatter: EMPTY_FRONTMATTER, body: 'just text' })).toBe(
      'untitled.md',
    );
  });
});
