import { describe, expect, it } from 'vitest';

import { liftWidthCap } from '@/editors/preview/mermaid';

/**
 * Mermaid caps every diagram at its own natural layout width, inline. Because
 * an inline style outranks any stylesheet rule, the cap has to be rewritten in
 * the markup — see `liftWidthCap`.
 */

/** Shaped after real mermaid 11 output, including the `<style>` it inlines. */
const svg = (cap: string, extra = '') =>
  `<svg id="mermaid-2" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart"` +
  ` style="max-width: ${cap};" viewBox="0 0 712.96875 408" role="graphics-document document"` +
  ` aria-roledescription="flowchart-v2">` +
  `<style>#mermaid-2{font-family:arial;}#mermaid-2 .label foreignObject{max-width:200px;}</style>` +
  `${extra}<g class="root"></g></svg>`;

describe('liftWidthCap', () => {
  it('doubles the cap mermaid stamps on the root svg', () => {
    expect(liftWidthCap(svg('712.96875px'))).toContain('style="max-width: 1425.9375px;"');
  });

  it('leaves the cap inside mermaid’s inlined <style> alone', () => {
    const out = liftWidthCap(svg('712.96875px'));
    // The label cap is mermaid's own layout constraint; doubling it would
    // reflow text inside a viewBox that was measured against 200px.
    expect(out).toContain('foreignObject{max-width:200px;}');
    expect(out).not.toContain('max-width:400px');
  });

  it('keeps the rest of the markup byte-identical', () => {
    const before = svg('712.96875px');
    const after = liftWidthCap(before);
    expect(after.replace('1425.9375px', '712.96875px')).toBe(before);
  });

  it('handles an integer cap', () => {
    expect(liftWidthCap(svg('450px'))).toContain('style="max-width: 900px;"');
  });

  it('rewrites only the first cap it finds in the opening tag', () => {
    const out = liftWidthCap(svg('100px', '<rect style="max-width: 50px;" />'));
    expect(out).toContain('style="max-width: 200px;"');
    expect(out).toContain('<rect style="max-width: 50px;" />');
  });

  it('passes through markup with no cap to widen', () => {
    const plain = '<svg width="100%" viewBox="0 0 10 10"><g></g></svg>';
    expect(liftWidthCap(plain)).toBe(plain);
  });

  it('leaves a degenerate cap untouched rather than emitting 0px', () => {
    expect(liftWidthCap(svg('0px'))).toContain('style="max-width: 0px;"');
  });
});
