import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '@/core/markdown/render';

/**
 * §6 flavor table: every extension must render correctly through the shared
 * pipeline, and the sanitizer must strip dangerous HTML (§7 security).
 */
describe('shared render pipeline (FR-4.1, §6)', () => {
  it('renders GFM tables with alignment', async () => {
    const html = await renderMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toContain('align="left"');
    expect(html).toContain('align="right"');
  });

  it('renders task lists as checkboxes (read-only in preview)', async () => {
    const html = await renderMarkdown('- [ ] todo\n- [x] done');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
    expect(html).toContain('checked');
  });

  it('renders strikethrough', async () => {
    const html = await renderMarkdown('~~gone~~');
    expect(html).toContain('<del>gone</del>');
  });

  it('autolinks bare URLs', async () => {
    const html = await renderMarkdown('visit https://example.com now');
    expect(html).toContain('<a href="https://example.com"');
  });

  it('renders footnotes with backlinks', async () => {
    const html = await renderMarkdown('text[^1]\n\n[^1]: the note');
    expect(html).toContain('data-footnote-ref');
    expect(html).toContain('data-footnote-backref');
  });

  it('renders inline and block math with KaTeX', async () => {
    const html = await renderMarkdown('inline $x^2$ and\n\n$$\n\\int_0^1 x\\,dx\n$$');
    expect(html).toContain('katex');
    expect(html).toContain('katex-display');
  });

  it('keeps mermaid fences as language-mermaid code for lazy rendering', async () => {
    const html = await renderMarkdown('```mermaid\ngraph TD; A-->B;\n```');
    expect(html).toContain('language-mermaid');
    expect(html).toContain('graph TD');
  });

  it('hides frontmatter from output (§6)', async () => {
    const html = await renderMarkdown('---\ntitle: Secret\n---\n\n# Visible');
    expect(html).not.toContain('Secret');
    expect(html).toContain('Visible');
  });

  it('renders callouts as styled boxes with title (FR-5.10)', async () => {
    const html = await renderMarkdown('> [!WARNING]\n> Careful now.');
    expect(html).toContain('callout callout-warning');
    expect(html).toContain('callout-title');
    expect(html).toContain('Warning');
    expect(html).toContain('Careful now.');
  });

  it('renders callouts with custom titles', async () => {
    const html = await renderMarkdown('> [!TIP] Pro move\n> Do the thing.');
    expect(html).toContain('callout-tip');
    expect(html).toContain('Pro move');
  });

  it('leaves normal blockquotes untouched', async () => {
    const html = await renderMarkdown('> just a quote');
    expect(html).toContain('<blockquote');
    expect(html).not.toContain('callout');
  });

  it('renders sanitized raw HTML — safe tags kept, scripts stripped', async () => {
    const html = await renderMarkdown(
      '<b>bold</b> <script>alert(1)</script> <em onclick="x()">em</em>',
    );
    expect(html).toContain('<b>bold</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).toContain('<em>em</em>');
  });

  it('strips javascript: URLs', async () => {
    const html = await renderMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('allows data: image sources (D14 base64 fallback)', async () => {
    const html = await renderMarkdown('![x](data:image/png;base64,AAAA)');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('highlights fenced code', async () => {
    const html = await renderMarkdown('```js\nconst x = 1;\n```');
    expect(html).toContain('hljs-keyword');
  });

  it('stamps data-sourcepos on block elements (scroll sync)', async () => {
    const html = await renderMarkdown('# One\n\ntext\n\n## Two');
    expect(html).toContain('data-sourcepos="1"');
    expect(html).toContain('data-sourcepos="3"');
    expect(html).toContain('data-sourcepos="5"');
  });

  it('renders invalid LaTeX with a graceful error, not a crash', async () => {
    const html = await renderMarkdown('$\\frac{$');
    expect(html).toContain('katex');
  });
});
