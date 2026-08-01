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
 * A power of two keeps the doubled value exact in binary, so the rewritten cap
 * carries no float noise.
 */
const MAX_UPSCALE = 2;

/**
 * Only the cap inside the opening `<svg …>` tag: `[^>]` cannot cross out of
 * the tag, so the `<style>` block mermaid inlines right after it — which has
 * `max-width` declarations of its own for HTML labels — is left alone.
 */
const WIDTH_CAP = /^([^<]*<svg\b[^>]*?max-width:\s*)(\d+(?:\.\d+)?)px/i;

/**
 * Widen mermaid's self-imposed width cap.
 *
 * Every diagram type ships `width="100%"` plus an inline
 * `style="max-width:<layout width>px"` (its `useMaxWidth` default): fill the
 * container, but never grow past whatever width mermaid's own text metrics
 * produced. That width is unrelated to our column, so a diagram stalls partway
 * across a wide page — and an inline style outranks every stylesheet rule, so
 * CSS cannot raise the cap.
 *
 * Lifting the cap to a bounded multiple rather than dropping it keeps the
 * useful half of mermaid's rule: a diagram fills a column up to `MAX_UPSCALE`×
 * its natural width, while a two-node graph (85 px wide) still can't be
 * inflated to span a 1200 px page.
 */
export function liftWidthCap(svg: string): string {
  return svg.replace(WIDTH_CAP, (whole, head: string, px: string) => {
    const natural = Number.parseFloat(px);
    return natural > 0 ? `${head}${natural * MAX_UPSCALE}px` : whole;
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
  const fitted = liftWidthCap(svg);
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
