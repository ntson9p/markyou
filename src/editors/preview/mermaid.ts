/**
 * Lazy Mermaid rendering (§6 flavor, R7): the mermaid chunk loads on first
 * use; rendered SVG is cached by (theme, code) so unrelated edits don't
 * re-render diagrams.
 */

type MermaidModule = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidModule> | null = null;
let initializedTheme: string | null = null;
const svgCache = new Map<string, string>();
let renderSeq = 0;

/**
 * How far past its natural width a diagram may be stretched to fill a column.
 *
 * A power of two keeps the scaled value exact in binary, so the rewritten
 * bounds carry no float noise.
 */
const MAX_UPSCALE = 2;

/**
 * Only the bound inside the opening `<svg …>` tag: `[^>]` cannot cross out of
 * the tag, so the `<style>` block mermaid inlines right after it — which has
 * `max-width` declarations of its own for HTML labels — is left alone.
 */
const WIDTH_CAP = /^([^<]*<svg\b[^>]*?max-width:\s*)(\d+(?:\.\d+)?)px/i;

/**
 * Rewrite mermaid's width bounds so a diagram sizes to the column it lands in.
 *
 * Every diagram type ships `width="100%"` plus an inline
 * `style="max-width:<natural layout width>px"` (its `useMaxWidth` default).
 * On its own that reads "fill the container, but never exceed the width my own
 * text metrics produced" — and being inline it outranks every stylesheet rule.
 * The result is wrong at both ends: the diagram stalls partway across a widened
 * page, and in a column narrower than its natural width it is squeezed below
 * legibility. In a 72ch column this diagram's 16 px labels painted at 11.5 px,
 * noticeably smaller than the prose beside them.
 *
 * The rewritten bounds clamp rather than only cap:
 *
 *     width = clamp(natural, column, MAX_UPSCALE × natural)
 *
 * So a diagram fills a widened page; it holds its natural size — and therefore
 * its type size — in a column too narrow for it, leaving the surrounding
 * scroll container to take over (the same bargain as an over-wide table); and
 * a two-node graph is never inflated to span a 1200 px page.
 *
 * Applied once, at the single render choke point, so every surface agrees.
 */
export function fitDiagramWidth(svg: string): string {
  return svg.replace(WIDTH_CAP, (whole, head: string, px: string) => {
    const natural = Number.parseFloat(px);
    if (natural <= 0) return whole;
    return `${head}${natural * MAX_UPSCALE}px; min-width: ${natural}px`;
  });
}

async function getMermaid(dark: boolean): Promise<MermaidModule> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  const theme = dark ? 'dark' : 'default';
  if (initializedTheme !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme });
    initializedTheme = theme;
  }
  return mermaid;
}

export async function renderMermaidToSvg(code: string, dark: boolean): Promise<string> {
  const key = `${dark ? 'd' : 'l'}\u0000${code}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const mermaid = await getMermaid(dark);
  const { svg } = await mermaid.render(`mermaid-${++renderSeq}`, code);
  // Cache the fitted markup: every consumer (WYSIWYG node view, preview,
  // export, the editor modal) wants the same sizing, and none can forget it.
  const fitted = fitDiagramWidth(svg);
  svgCache.set(key, fitted);
  if (svgCache.size > 100) {
    const first = svgCache.keys().next().value;
    if (first !== undefined) svgCache.delete(first);
  }
  return fitted;
}

/** Replace `pre > code.language-mermaid` blocks inside `root` with rendered SVG. */
export async function renderMermaidBlocks(root: HTMLElement, dark: boolean): Promise<void> {
  const blocks = Array.from(root.querySelectorAll('pre > code.language-mermaid'));
  if (blocks.length === 0) return;

  await Promise.all(
    blocks.map(async (codeEl) => {
      const pre = codeEl.parentElement!;
      const code = codeEl.textContent ?? '';
      const container = document.createElement('div');
      container.className = 'mermaid-diagram';
      container.setAttribute('data-mermaid-source', code);
      try {
        // Mermaid output is generated locally with securityLevel:'strict'
        // (labels sanitized); no document-provided HTML is injected.
        container.innerHTML = await renderMermaidToSvg(code, dark);
      } catch (e) {
        container.className = 'mermaid-error';
        container.textContent = `Mermaid: ${e instanceof Error ? e.message.split('\n')[0] : 'diagram error'}`;
      }
      // The DOM may have re-rendered while we were awaiting.
      if (pre.isConnected) pre.replaceWith(container);
    }),
  );
}
