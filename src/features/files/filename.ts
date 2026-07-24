import type { DocState } from '@/core/document/store';

/** Suggest a filename for Save As (FR-1.4): existing name → frontmatter title → first heading → untitled. */
export function suggestFileName(state: Pick<DocState, 'file' | 'frontmatter' | 'body'>): string {
  if (state.file?.name) return state.file.name;

  const title =
    (typeof state.frontmatter.data?.title === 'string' && state.frontmatter.data.title) ||
    firstHeading(state.body);
  if (title) {
    const slug = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    if (slug) return `${slug}.md`;
  }
  return 'untitled.md';
}

function firstHeading(body: string): string | null {
  const m = /^#{1,6}\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : null;
}
