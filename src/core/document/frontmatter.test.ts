import { describe, expect, it } from 'vitest';

import {
  mergeFrontmatter,
  parseFrontmatterBlock,
  splitAndParse,
  splitFrontmatter,
} from '@/core/document/frontmatter';

describe('splitFrontmatter', () => {
  it('splits a standard YAML block byte-faithfully', () => {
    const text = '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Heading\n\nBody.\n';
    const { block, body } = splitFrontmatter(text);
    expect(block).toBe('---\ntitle: Hello\ntags: [a, b]\n---\n');
    expect(body).toBe('\n# Heading\n\nBody.\n');
    expect(block! + body).toBe(text);
  });

  it('handles CRLF line endings byte-faithfully', () => {
    const text = '---\r\ntitle: X\r\n---\r\nBody\r\n';
    const { block, body } = splitFrontmatter(text);
    expect(block! + body).toBe(text);
    expect(body).toBe('Body\r\n');
  });

  it('returns no block when the document does not start with ---', () => {
    const text = '# Hi\n---\nnot frontmatter\n---\n';
    expect(splitFrontmatter(text)).toEqual({ block: null, body: text });
  });

  it('treats an unclosed fence as content, not frontmatter', () => {
    const text = '---\ntitle: unclosed\n';
    expect(splitFrontmatter(text)).toEqual({ block: null, body: text });
  });

  it('handles a frontmatter-only document without trailing newline', () => {
    const text = '---\na: 1\n---';
    const { block, body } = splitFrontmatter(text);
    expect(block).toBe(text);
    expect(body).toBe('');
  });

  it('handles empty frontmatter', () => {
    const text = '---\n---\nBody\n';
    const { block, body } = splitFrontmatter(text);
    expect(block).toBe('---\n---\n');
    expect(body).toBe('Body\n');
  });

  it('does not treat a thematic break mid-document as a closing fence boundary error', () => {
    const text = '---\ntitle: t\n---\n\ntext\n\n---\n\nmore\n';
    const { block, body } = splitFrontmatter(text);
    expect(block).toBe('---\ntitle: t\n---\n');
    expect(body).toBe('\ntext\n\n---\n\nmore\n');
  });
});

describe('parseFrontmatterBlock', () => {
  it('parses valid YAML mappings', () => {
    const fm = parseFrontmatterBlock('---\ntitle: Hello\ncount: 3\n---\n');
    expect(fm.valid).toBe(true);
    expect(fm.data).toEqual({ title: 'Hello', count: 3 });
  });

  it('flags invalid YAML with an error (FR-10.4 fallback)', () => {
    const fm = parseFrontmatterBlock('---\ntitle: [unclosed\n---\n');
    expect(fm.valid).toBe(false);
    expect(fm.data).toBeNull();
    expect(fm.error).toBeTruthy();
  });

  it('flags non-mapping YAML as invalid', () => {
    const fm = parseFrontmatterBlock('---\n- just\n- a list\n---\n');
    expect(fm.valid).toBe(false);
  });

  it('treats empty frontmatter as a valid empty mapping', () => {
    const fm = parseFrontmatterBlock('---\n---\n');
    expect(fm.valid).toBe(true);
    expect(fm.data).toEqual({});
  });
});

describe('splitAndParse + mergeFrontmatter round-trip', () => {
  const cases = [
    '---\ntitle: X\n---\n# Body\n',
    'no frontmatter at all\n',
    '---\nbroken: [yaml\n---\nbody\n',
    '',
    '---\n---\n',
    '---\r\na: 1\r\n---\r\nCRLF body\r\n',
  ];
  for (const text of cases) {
    it(`round-trips ${JSON.stringify(text.slice(0, 24))}…`, () => {
      const { frontmatter, body } = splitAndParse(text);
      expect(mergeFrontmatter(frontmatter, body)).toBe(text);
    });
  }
});
