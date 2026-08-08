import { beforeEach, describe, expect, it } from 'vitest';

import { applyEol, detectEol, getFullText, normalizeEol, useDocStore } from '@/core/document/store';

describe('DocumentStore', () => {
  beforeEach(() => {
    useDocStore.getState().closeDocument();
  });

  it('starts on the welcome screen', () => {
    expect(useDocStore.getState().status).toBe('welcome');
  });

  it('newDocument opens an empty untitled doc (FR-1.1)', () => {
    useDocStore.getState().newDocument();
    const s = useDocStore.getState();
    expect(s.status).toBe('open');
    expect(s.body).toBe('');
    expect(s.file).toBeNull();
    expect(s.dirty).toBe(false);
    expect(s.docId).toBeTruthy();
  });

  it('openDocument splits frontmatter at the store boundary (plan §1.2)', () => {
    useDocStore.getState().openDocument({
      text: '---\ntitle: T\n---\n# Body\n',
      file: null,
    });
    const s = useDocStore.getState();
    expect(s.body).toBe('# Body\n');
    expect(s.frontmatter.rawBlock).toBe('---\ntitle: T\n---\n');
    expect(s.frontmatter.data).toEqual({ title: 'T' });
    expect(getFullText(s)).toBe('---\ntitle: T\n---\n# Body\n');
  });

  it('setFullText re-splits frontmatter and bumps version with origin', () => {
    useDocStore.getState().newDocument();
    useDocStore.getState().setFullText('---\na: 1\n---\nhello', 'raw');
    const s = useDocStore.getState();
    expect(s.version).toBe(1);
    expect(s.origin).toBe('raw');
    expect(s.dirty).toBe(true);
    expect(s.body).toBe('hello');
    expect(s.frontmatter.data).toEqual({ a: 1 });
  });

  it('setFullText short-circuits on identical content (loop guard)', () => {
    useDocStore.getState().newDocument();
    useDocStore.getState().setFullText('same', 'raw');
    const v = useDocStore.getState().version;
    useDocStore.getState().setFullText('same', 'wysiwyg');
    expect(useDocStore.getState().version).toBe(v);
    expect(useDocStore.getState().origin).toBe('raw');
  });

  it('setBody keeps the frontmatter block untouched (FR-5.12)', () => {
    useDocStore.getState().openDocument({ text: '---\nkey: v\n---\nold', file: null });
    useDocStore.getState().setBody('new body', 'wysiwyg');
    const s = useDocStore.getState();
    expect(s.frontmatter.rawBlock).toBe('---\nkey: v\n---\n');
    expect(getFullText(s)).toBe('---\nkey: v\n---\nnew body');
    expect(s.origin).toBe('wysiwyg');
  });

  it('setFrontmatterBlock updates and removes the block (FR-10.4)', () => {
    useDocStore.getState().openDocument({ text: 'body only', file: null });
    useDocStore.getState().setFrontmatterBlock('---\nt: 1\n---\n');
    expect(getFullText(useDocStore.getState())).toBe('---\nt: 1\n---\nbody only');
    useDocStore.getState().setFrontmatterBlock(null);
    expect(getFullText(useDocStore.getState())).toBe('body only');
  });

  it('markSaved clears dirty and records savedText', () => {
    useDocStore.getState().newDocument();
    useDocStore.getState().setFullText('content', 'raw');
    expect(useDocStore.getState().dirty).toBe(true);
    useDocStore.getState().markSaved({ kind: 'memory', name: 'x.md', canSaveInPlace: false });
    const s = useDocStore.getState();
    expect(s.dirty).toBe(false);
    expect(s.savedText).toBe('content');
    expect(s.lastSavedAt).not.toBeNull();
  });

  it('system origin does not mark the doc dirty', () => {
    useDocStore.getState().newDocument();
    useDocStore.getState().setFullText('external update', 'system');
    expect(useDocStore.getState().dirty).toBe(false);
    expect(useDocStore.getState().version).toBe(1);
  });
});

describe('EOL policy (LF-canonical store, flavor preserved for saves)', () => {
  beforeEach(() => {
    useDocStore.getState().closeDocument();
  });

  it('openDocument normalizes CRLF and records the flavor', () => {
    useDocStore.getState().openDocument({ text: '# T\r\n\r\nalpha\r\n', file: null });
    const s = useDocStore.getState();
    expect(s.body).toBe('# T\n\nalpha\n');
    expect(s.savedText).toBe('# T\n\nalpha\n');
    expect(s.eol).toBe('crlf');
  });

  it('an LF file keeps the lf flavor', () => {
    useDocStore.getState().openDocument({ text: '# T\nalpha\n', file: null });
    expect(useDocStore.getState().eol).toBe('lf');
  });

  it('a recovery savedText baseline is normalized too', () => {
    useDocStore.getState().openDocument({
      text: 'draft text\n',
      file: null,
      dirty: true,
      savedText: 'disk\r\ntext\r\n',
    });
    expect(useDocStore.getState().savedText).toBe('disk\ntext\n');
  });

  it('the CRLF file content round-trips through applyEol', () => {
    const disk = '# T\r\n\r\nalpha\r\n';
    expect(applyEol(normalizeEol(disk), detectEol(disk))).toBe(disk);
  });

  it('setFullText and restoreText normalize stray CRLF input', () => {
    useDocStore.getState().newDocument();
    useDocStore.getState().setFullText('a\r\nb', 'raw');
    expect(useDocStore.getState().body).toBe('a\nb');
    useDocStore.getState().restoreText('c\r\nd');
    expect(useDocStore.getState().body).toBe('c\nd');
  });
});
