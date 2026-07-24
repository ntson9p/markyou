import { describe, expect, it } from 'vitest';

import { extractOutline } from '@/core/markdown/outline';

describe('extractOutline (FR-10.1 data source)', () => {
  it('extracts the heading tree with depths and lines', () => {
    const outline = extractOutline('# Top\n\ntext\n\n## Sub *emphasized*\n\n### Deep\n');
    expect(outline).toEqual([
      { depth: 1, text: 'Top', line: 1 },
      { depth: 2, text: 'Sub emphasized', line: 5 },
      { depth: 3, text: 'Deep', line: 7 },
    ]);
  });

  it('ignores headings inside code fences (real parser, not regex)', () => {
    const outline = extractOutline('```\n# not a heading\n```\n\n# Real\n');
    expect(outline).toEqual([{ depth: 1, text: 'Real', line: 5 }]);
  });

  it('returns empty for headingless documents', () => {
    expect(extractOutline('just text')).toEqual([]);
  });
});
