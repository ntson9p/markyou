import { describe, expect, it } from 'vitest';

import { buildStandaloneHtml } from './html-standalone';

describe('buildStandaloneHtml (FR-11.1)', () => {
  it('produces a self-contained document matching the preview', async () => {
    const html = await buildStandaloneHtml('My Doc', '# Title\n\nHello **world** and $x^2$.\n');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>My Doc</title>');
    // Inlined shared typography (the `.md-doc` theme). (KaTeX CSS is inlined by
    // the real Vite build; vitest returns '' for node_modules ?inline imports.)
    expect(html).toContain('.md-doc {');
    // Rendered, not raw markdown — including KaTeX math output.
    expect(html).toContain('<article class="md-doc">');
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('**world**');
  });

  it('escapes the document title', async () => {
    const html = await buildStandaloneHtml('<script>alert(1)</script>', 'x\n');
    expect(html).toContain('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>');
  });
});
