import { describe, expect, it } from 'vitest';

import { splitAndParse } from '@/core/document/frontmatter';

import {
  allScalar,
  buildFrontmatterBlock,
  coerceScalar,
  innerYaml,
  rawToBlock,
} from './frontmatter-io';

describe('frontmatter-io (FR-10.4)', () => {
  it('builds a block that round-trips through the store split', () => {
    const block = buildFrontmatterBlock({ title: 'Hello', draft: true, count: 3 });
    expect(block).not.toBeNull();
    const { frontmatter, body } = splitAndParse(block! + 'body text\n');
    expect(frontmatter.valid).toBe(true);
    expect(frontmatter.data).toEqual({ title: 'Hello', draft: true, count: 3 });
    expect(body).toBe('body text\n');
  });

  it('returns null for an empty map (removes the block)', () => {
    expect(buildFrontmatterBlock({})).toBeNull();
  });

  it('coerces scalar text to number/boolean/null/string', () => {
    expect(coerceScalar('42')).toBe(42);
    expect(coerceScalar('-3.5')).toBe(-3.5);
    expect(coerceScalar('true')).toBe(true);
    expect(coerceScalar('false')).toBe(false);
    expect(coerceScalar('null')).toBeNull();
    expect(coerceScalar('hello')).toBe('hello');
    expect(coerceScalar('  spaced  ')).toBe('  spaced  ');
  });

  it('detects non-scalar maps', () => {
    expect(allScalar({ a: 1, b: 'x' })).toBe(true);
    expect(allScalar({ tags: ['a', 'b'] })).toBe(false);
    expect(allScalar({ nested: { x: 1 } })).toBe(false);
  });

  it('wraps and strips raw YAML symmetrically', () => {
    const block = rawToBlock('title: T\ntags: [a, b]');
    expect(block).toBe('---\ntitle: T\ntags: [a, b]\n---\n');
    expect(innerYaml(block)).toBe('title: T\ntags: [a, b]');
    expect(rawToBlock('   ')).toBe('');
  });
});
