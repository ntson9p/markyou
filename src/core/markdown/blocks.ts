import { parseMarkdown } from '@/core/markdown/parse';

/**
 * 1-based body start line of each top-level block, from the shared grammar.
 * mdast children and ProseMirror doc children align by construction, so this
 * is the bridge for block-index scroll sync (§2.3) and outline jumps (FR-10.1).
 */
export function topLevelBlockLines(body: string): number[] {
  const tree = parseMarkdown(body);
  const lines = tree.children
    .map((c) => c.position?.start.line ?? 1)
    .filter((n) => Number.isFinite(n));
  return lines.length > 0 ? lines : [1];
}
