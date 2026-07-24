import type { Root } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified, type Processor } from 'unified';

/**
 * The ONE markdown grammar (plan §1.3): CommonMark + GFM + math + frontmatter.
 * Every consumer — preview rendering, outline, scroll-sync block mapping, and
 * the WYSIWYG parser configuration — derives from this plugin set. Never add
 * a second, divergent parse path.
 */
export function createParseProcessor(): Processor<Root> {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath) as unknown as Processor<Root>;
}

let cached: Processor<Root> | null = null;

/** Parse markdown to mdast using the shared grammar (no transforms applied). */
export function parseMarkdown(text: string): Root {
  cached ??= createParseProcessor();
  return cached.parse(text) as Root;
}
