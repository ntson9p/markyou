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
 * Mermaid frames a flowchart in 8 px of blank margin on every side. Measured on
 * a typical diagram that is 16 px of a 713 px viewBox — 2.2% of the width spent
 * on nothing. Trimming it to 2 px keeps a hair of slack for edge strokes and
 * marker arrowheads, which `getBBox` includes but antialiasing can still shave.
 */
const DIAGRAM_PADDING = 2;

/**
 * How far the declared canvas may exceed the drawing before we treat it as
 * broken rather than as deliberate margin.
 *
 * Measured across all 23 mermaid diagram types, the largest honest gap is
 * 1.59× (C4, vertically); most sit at 1.0–1.3×. A genuinely corrupt canvas is
 * an order of magnitude out — the report that prompted this was 23×. Four
 * leaves wide headroom above the honest maximum and well below the failure.
 */
const OVERSIZED_CANVAS_FACTOR = 4;

export interface CanvasRefit {
  from: [number, number];
  to: [number, number];
}

/**
 * Repair a diagram whose declared canvas does not match what it draws.
 *
 * Mermaid lays out off-screen and bakes the resulting bounds into `viewBox`.
 * That measurement can come out wildly too large — an HTML label inside a
 * `foreignObject` that has not been laid out yet reports a clamped 16384px, and
 * the canvas is sized to enclose it. The drawing itself is fine, but it is then
 * scaled to a few percent to fit a canvas 20× too big, so the diagram appears
 * microscopic and no amount of CSS can recover it.
 *
 * Once the SVG is in the live document its real bounds are measurable, so
 * re-fit the canvas to them. Shrink only: `gantt` legitimately draws *past* its
 * declared canvas, and growing to meet that would wreck it.
 *
 * Returns what it changed, or null if the canvas was already honest.
 */
export function refitOversizedCanvas(host: HTMLElement): CanvasRefit | null {
  const svg = host.querySelector('svg');
  if (!svg?.isConnected) return null;

  const declared = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
  if (declared.length !== 4 || !declared.every((n) => Number.isFinite(n))) return null;

  let drawn: DOMRect;
  try {
    // On an <svg>, getBBox unions the children in this element's own user
    // space — viewBox coordinates — which is exactly the comparison we want.
    drawn = (svg as unknown as SVGGraphicsElement).getBBox();
  } catch {
    return null;
  }
  if (!(drawn.width > 0) || !(drawn.height > 0)) return null;

  const tooWide = declared[2] >= drawn.width * OVERSIZED_CANVAS_FACTOR;
  const tooTall = declared[3] >= drawn.height * OVERSIZED_CANVAS_FACTOR;
  if (!tooWide && !tooTall) return null;

  const width = drawn.width + DIAGRAM_PADDING * 2;
  const height = drawn.height + DIAGRAM_PADDING * 2;
  svg.setAttribute(
    'viewBox',
    `${drawn.x - DIAGRAM_PADDING} ${drawn.y - DIAGRAM_PADDING} ${width} ${height}`,
  );
  // The stale cap would otherwise still advertise the bogus natural width.
  svg.style.maxWidth = `${width}px`;
  return { from: [declared[2], declared[3]], to: [width, height] };
}

/** Re-fit once the host is actually in the document, where bounds are real. */
export function refitWhenAttached(host: HTMLElement, attempts = 3): void {
  if (host.isConnected) {
    refitOversizedCanvas(host);
    return;
  }
  if (attempts > 0) requestAnimationFrame(() => refitWhenAttached(host, attempts - 1));
}

async function getMermaid(dark: boolean): Promise<MermaidModule> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  const theme = dark ? 'dark' : 'default';
  if (initializedTheme !== theme) {
    // `useMaxWidth` is left at its default: mermaid stamps `width="100%"` plus
    // an inline `max-width:<natural layout width>px`, which is exactly the rule
    // we want — fill the column, never scale up past natural size. Sizing below
    // that is CSS's business (see `.diagram-node` / `.mermaid-diagram`).
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      flowchart: { diagramPadding: DIAGRAM_PADDING },
    });
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
  svgCache.set(key, svg);
  if (svgCache.size > 100) {
    const first = svgCache.keys().next().value;
    if (first !== undefined) svgCache.delete(first);
  }
  return svg;
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
      if (pre.isConnected) {
        pre.replaceWith(container);
        refitOversizedCanvas(container);
      }
    }),
  );
}
