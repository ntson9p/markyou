import { describe, expect, it } from 'vitest';

import { fitDiagramWidth } from '@/editors/preview/mermaid';

/**
 * Mermaid bounds every diagram by its own natural layout width, inline. Because
 * an inline style outranks any stylesheet rule, the bounds have to be rewritten
 * in the markup — see `fitDiagramWidth`.
 */

/** Shaped after real mermaid 11 output, including the `<style>` it inlines. */
const svg = (cap: string, extra = '') =>
  `<svg id="mermaid-2" width="100%" xmlns="http://www.w3.org/2000/svg" class="flowchart"` +
  ` style="max-width: ${cap};" viewBox="0 0 712.96875 408" role="graphics-document document"` +
  ` aria-roledescription="flowchart-v2">` +
  `<style>#mermaid-2{font-family:arial;}#mermaid-2 .label foreignObject{max-width:200px;}</style>` +
  `${extra}<g class="root"></g></svg>`;

describe('fitDiagramWidth', () => {
  it('raises the ceiling to twice the natural width', () => {
    expect(fitDiagramWidth(svg('712.96875px'))).toContain('max-width: 1425.9375px');
  });

  it('adds a floor at the natural width so a narrow column scrolls instead of shrinking', () => {
    expect(fitDiagramWidth(svg('712.96875px'))).toContain('min-width: 712.96875px');
  });

  it('emits both bounds as valid declarations in the one style attribute', () => {
    expect(fitDiagramWidth(svg('712.96875px'))).toContain(
      'style="max-width: 1425.9375px; min-width: 712.96875px;"',
    );
  });

  it('leaves the cap inside mermaid’s inlined <style> alone', () => {
    const out = fitDiagramWidth(svg('712.96875px'));
    // The label cap is mermaid's own layout constraint; touching it would
    // reflow text inside a viewBox that was measured against 200px.
    expect(out).toContain('foreignObject{max-width:200px;}');
    expect(out).not.toContain('foreignObject{max-width:400px;}');
  });

  it('keeps the rest of the markup byte-identical', () => {
    const before = svg('712.96875px');
    const after = fitDiagramWidth(before);
    expect(after.replace('1425.9375px; min-width: 712.96875px', '712.96875px')).toBe(before);
  });

  it('handles an integer bound', () => {
    expect(fitDiagramWidth(svg('450px'))).toContain('max-width: 900px; min-width: 450px');
  });

  it('rewrites only the opening tag, not a bound further down the markup', () => {
    const out = fitDiagramWidth(svg('100px', '<rect style="max-width: 50px;" />'));
    expect(out).toContain('style="max-width: 200px; min-width: 100px;"');
    expect(out).toContain('<rect style="max-width: 50px;" />');
  });

  it('passes through markup with no bound to rewrite', () => {
    const plain = '<svg width="100%" viewBox="0 0 10 10"><g></g></svg>';
    expect(fitDiagramWidth(plain)).toBe(plain);
  });

  it('leaves a degenerate bound untouched rather than emitting 0px', () => {
    const out = fitDiagramWidth(svg('0px'));
    expect(out).toContain('style="max-width: 0px;"');
    expect(out).not.toContain('min-width');
  });
});
