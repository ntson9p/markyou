import 'katex/dist/katex.min.css';

import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { remarkCallouts } from '@/core/markdown/callouts';
import { sanitizeSchema } from '@/core/markdown/sanitize-schema';
import { rehypeSourcepos } from '@/core/markdown/sourcepos';

/**
 * The shared render pipeline (FR-4.1): markdown body → sanitized HTML.
 * Lazy-loaded as a chunk (KaTeX is heavy) — the initial-JS budget excludes it.
 *
 * Pipeline order matters:
 *  1. remark plugins = the ONE grammar (same set as core/markdown/parse.ts)
 *  2. remark-rehype with raw HTML passed through…
 *  3. …parsed by rehype-raw, then *sanitized* (allowlist schema),
 *  4. highlight + KaTeX run after sanitize on locally-generated output,
 *  5. sourcepos stamps for scroll sync.
 */
const renderProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkCallouts)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeHighlight, { detect: false })
  .use(rehypeKatex, { errorColor: 'var(--destructive)' })
  .use(rehypeSourcepos)
  .use(rehypeStringify);

/** Render a markdown body to sanitized HTML. */
export async function renderMarkdown(body: string): Promise<string> {
  const file = await renderProcessor.process(body);
  return String(file);
}
