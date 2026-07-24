import { describe, expect, it } from 'vitest';

import { calloutTitle, parseCalloutMarker } from '@/core/markdown/callouts';

describe('parseCalloutMarker', () => {
  it('parses all five GitHub callout types case-insensitively', () => {
    for (const t of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION', 'note', 'Tip']) {
      const m = parseCalloutMarker(`[!${t}]`);
      expect(m?.type).toBe(t.toLowerCase());
    }
  });

  it('parses an optional title (Obsidian style)', () => {
    const m = parseCalloutMarker('[!note] My Title\nrest');
    expect(m).toMatchObject({ type: 'note', title: 'My Title' });
  });

  it('rejects unknown types', () => {
    expect(parseCalloutMarker('[!banana]')).toBeNull();
  });

  it('rejects markers not at the start', () => {
    expect(parseCalloutMarker('text [!note]')).toBeNull();
  });

  it('derives display titles', () => {
    expect(calloutTitle({ type: 'warning', title: '' })).toBe('Warning');
    expect(calloutTitle({ type: 'note', title: 'Custom' })).toBe('Custom');
  });
});
