import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_STYLE_PREFS, markdownStringWidth } from '@/core/markdown/style';

import { createRoundtripper, type Roundtripper } from './harness';

/**
 * Table style (FR-13.2): compact by default — a WYSIWYG re-serialization must
 * not re-pad table rows the user never touched. Alignment is opt-in.
 */
describe('table style: compact by default', () => {
  let rt: Roundtripper;
  beforeAll(async () => {
    rt = await createRoundtripper();
  });
  afterAll(() => rt.destroy());

  it('a canonical compact table round-trips byte-identically', () => {
    const src = [
      '| Term | Meaning |',
      '| - | - |',
      '| slot | One bookable time cell |',
      '| span | `[start, start + N)` |',
    ].join('\n');
    expect(rt.roundtrip(src).trimEnd()).toBe(src);
  });

  it('data rows stay untouched even when the delimiter row normalizes', () => {
    const src = ['| a | bbb |', '|---|-----|', '| x | y |'].join('\n');
    const out = rt.roundtrip(src).trimEnd().split('\n');
    expect(out[0]).toBe('| a | bbb |');
    expect(out[2]).toBe('| x | y |');
    // The AST records column alignment, not dash counts — the delimiter row
    // is the one honest residual of re-serialization.
    expect(out[1]).toBe('| - | - |');
  });

  it('alignment colons survive compaction', () => {
    const src = ['| a | b | c |', '| :- | :-: | -: |', '| 1 | 2 | 3 |'].join('\n');
    const out = rt.roundtrip(src).trimEnd().split('\n');
    expect(out[1]).toBe('| :- | :-: | -: |');
  });
});

describe('table style: opt-in alignment (CJK-aware)', () => {
  let rt: Roundtripper;
  beforeAll(async () => {
    rt = await createRoundtripper({ ...DEFAULT_STYLE_PREFS, tableAlign: true });
  });
  afterAll(() => rt.destroy());

  it('pads every row to the same display width, counting CJK as 2 columns', () => {
    const src = ['| 予約枠 | b |', '| - | - |', '| x | 説明テキスト |'].join('\n');
    const out = rt.roundtrip(src).trimEnd();
    const widths = new Set(out.split('\n').map(markdownStringWidth));
    expect(widths.size).toBe(1); // pipes line up in a monospace editor
  });

  it('aligned output is idempotent', () => {
    const src = ['| Term | Meaning |', '| - | - |', '| 枠 / slot | cell |'].join('\n');
    const once = rt.roundtrip(src);
    expect(rt.roundtrip(once)).toBe(once);
  });
});
