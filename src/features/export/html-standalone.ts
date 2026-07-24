import katexCss from 'katex/dist/katex.min.css?inline';

import typographyCss from '@/styles/typography.css?inline';

import { renderDocumentHtml } from './render-doc';

/** Page frame + print rules layered over the shared `.md-doc` typography. */
const PAGE_CSS = `
  html { color-scheme: light; background: #fff; }
  body { margin: 0; }
  .md-doc { max-width: 46rem; margin: 3rem auto; padding: 0 1.5rem; }
  @page { margin: 1.8cm; }
  @media print {
    .md-doc { margin: 0; max-width: none; padding: 0; }
    pre, table, blockquote, .callout, .mermaid-diagram, figure, img { break-inside: avoid; }
    h1, h2, h3, h4 { break-after: avoid; }
    a { color: inherit; text-decoration: underline; }
  }
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

/**
 * A single self-contained HTML document (FR-11.1): inlined typography + KaTeX
 * CSS + pre-rendered Mermaid SVG, matching the preview. (Relative-image
 * embedding rides along with the assets pipeline, FR-8.)
 */
export async function buildStandaloneHtml(title: string, body: string): Promise<string> {
  const content = await renderDocumentHtml(body);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${katexCss}</style>
<style>${typographyCss}</style>
<style>${PAGE_CSS}</style>
</head>
<body>
<article class="md-doc">${content}</article>
</body>
</html>`;
}

/** Trigger a browser download of an HTML string. */
export function downloadHtml(fileName: string, html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
