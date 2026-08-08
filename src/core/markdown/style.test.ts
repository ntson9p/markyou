import { describe, expect, it } from 'vitest';

import { DEFAULT_STYLE_PREFS, markdownStringWidth, toGfmOptions } from '@/core/markdown/style';

describe('table style options (FR-13.2)', () => {
  it('defaults to compact tables — no pipe alignment', () => {
    expect(DEFAULT_STYLE_PREFS.tableAlign).toBe(false);
    expect(toGfmOptions(DEFAULT_STYLE_PREFS)).toEqual({ tablePipeAlign: false });
  });

  it('opt-in alignment pads with a CJK-aware width', () => {
    const opts = toGfmOptions({ ...DEFAULT_STYLE_PREFS, tableAlign: true }) as {
      tablePipeAlign: boolean;
      stringLength?: (value: string) => number;
    };
    expect(opts.tablePipeAlign).toBe(true);
    expect(opts.stringLength?.('abc')).toBe(3);
    expect(opts.stringLength?.('予約枠')).toBe(6);
  });
});

describe('markdownStringWidth', () => {
  it('counts ASCII as 1 column', () => {
    expect(markdownStringWidth('slot / cell')).toBe(11);
  });

  it('counts CJK and fullwidth characters as 2 columns', () => {
    expect(markdownStringWidth('枠')).toBe(2);
    expect(markdownStringWidth('オプション')).toBe(10);
    expect(markdownStringWidth('「診療」')).toBe(8);
  });

  it('handles mixed content', () => {
    expect(markdownStringWidth('枠 / slot')).toBe(9); // 2 + 7 ASCII
  });
});
