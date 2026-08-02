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

/**
 * Diagram types that paint outside their own canvas on purpose, identified by
 * the `aria-roledescription` mermaid stamps on every SVG it emits.
 *
 * Only these may not have their canvas *enlarged* to enclose what they draw.
 * `gantt` positions its "today" marker on the real calendar: a chart of
 * January 2024 viewed in 2026 puts that one line at x≈35600 in a 1280-wide
 * canvas. Enclosing it would squeeze the chart into a 3%-wide sliver.
 *
 * Measured, not assumed: rendering all 22 stock diagram types on Chromium and
 * Firefox, `gantt` is the only one whose drawing escapes its canvas at all,
 * and `line.today` is the only element of it that does.
 */
const OVERDRAWING_TYPES = new Set(['gantt']);

export interface CanvasRefit {
  from: [number, number];
  to: [number, number];
}

/**
 * Repair a diagram whose declared canvas does not match what it draws.
 *
 * Mermaid lays out off-screen and bakes the resulting bounds into `viewBox`.
 * That calculation goes wrong in three observed ways, all fatal on screen:
 *
 *  - **Canvas far too large.** The drawing is then scaled to a few percent to
 *    fit and the diagram appears microscopic. Seen as a 16518×16439 canvas
 *    around a ~700px drawing.
 *  - **Canvas misplaced.** The origin lands away from the drawing, so one edge
 *    carries dead space and the opposite edge cuts content off — an SVG clips
 *    to its viewport. Seen as `-122.55 -52.73 876.96 371.60` around content
 *    occupying `8,8 744×359`: 130 units blank on the left, 48 units of diagram
 *    missing off the bottom.
 *  - **Canvas far too small.** Seen as a 1118-wide canvas around a 3078-wide
 *    flowchart of three side-by-side subgraphs: two thirds of the diagram is
 *    simply not painted, and what remains looks like a complete drawing, so
 *    nothing about it reads as an error.
 *
 * Once the SVG is in the live document its real bounds are measurable, so
 * re-fit the canvas to them — in either direction, since a canvas can be wrong
 * either way. `OVERDRAWING_TYPES` is the sole exception to enlarging.
 *
 * Returns what it changed, or null if the canvas was already honest.
 */
export function refitDiagramCanvas(host: HTMLElement): CanvasRefit | null {
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

  const oversized =
    declared[2] >= drawn.width * OVERSIZED_CANVAS_FACTOR ||
    declared[3] >= drawn.height * OVERSIZED_CANVAS_FACTOR;
  // A hair of tolerance so sub-pixel bounds never trip the repair.
  const clipped =
    drawn.x < declared[0] - 1 ||
    drawn.y < declared[1] - 1 ||
    drawn.x + drawn.width > declared[0] + declared[2] + 1 ||
    drawn.y + drawn.height > declared[1] + declared[3] + 1;
  if (!oversized && !clipped) {
    svg.dataset.refit = 'no';
    return null;
  }

  const width = drawn.width + DIAGRAM_PADDING * 2;
  const height = drawn.height + DIAGRAM_PADDING * 2;
  const grows = width > declared[2] + 1 || height > declared[3] + 1;
  if (grows && OVERDRAWING_TYPES.has(svg.getAttribute('aria-roledescription') ?? '')) {
    svg.dataset.refit = 'skipped-overdrawn';
    return null;
  }

  svg.setAttribute(
    'viewBox',
    `${drawn.x - DIAGRAM_PADDING} ${drawn.y - DIAGRAM_PADDING} ${width} ${height}`,
  );
  // The stale cap would otherwise still advertise the bogus natural width.
  svg.style.maxWidth = `${width}px`;
  svg.dataset.refit = `${Math.round(declared[2])}x${Math.round(declared[3])}->${Math.round(width)}x${Math.round(height)}`;
  return { from: [declared[2], declared[3]], to: [width, height] };
}

/** Re-fit once the host is actually in the document, where bounds are real. */
export function refitWhenAttached(host: HTMLElement, attempts = 3): void {
  if (host.isConnected) {
    refitDiagramCanvas(host);
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
    //
    // `htmlLabels: false` is load-bearing, not cosmetic. With HTML labels,
    // mermaid renders each label into a `<foreignObject>`, measures it with
    // `getBoundingClientRect()` — CSS pixels — and then uses those numbers as
    // SVG *user units*. That equivalence only holds when the measuring context
    // sits at scale 1, and it is the one place in the pipeline that crosses
    // coordinate systems. When it goes wrong the node boxes inflate while the
    // text inside them stays true size, so the whole diagram is laid out ~20×
    // too large and scales down to an unreadable smudge — reported from the
    // field as a 16902×8478 layout for a diagram that measures 701×396 here.
    // SVG `<text>` labels are measured with `getBBox()` in user units, so no
    // conversion is involved and the failure cannot occur.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme,
      htmlLabels: false,
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
        refitDiagramCanvas(container);
      }
    }),
  );
}
