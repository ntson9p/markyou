import { expect, test, type Page } from '@playwright/test';

/**
 * Repair for a diagram whose declared canvas does not match what it draws
 * (FR-5.9).
 *
 * Mermaid lays out off-screen and bakes the resulting bounds into `viewBox`.
 * Two failure shapes have been seen in the field, both fatal on screen:
 *
 *  - **Canvas far too large** — `-132 -53 16518 16439` around a ~700px drawing.
 *    Everything scales to 5% and the diagram is a smudge.
 *  - **Canvas misplaced** — `-122.55 -52.73 876.96 371.60` around content at
 *    `8,8 744×359`. 130 units of dead space on the left, and the bottom 48
 *    units of the diagram cut off, because an SVG clips to its viewport.
 *
 * The repair must never fire on an honest canvas — several diagram types carry
 * real margin — and must never enlarge one, because `gantt` paints background
 * rules far outside its own box on purpose.
 */

/** Served by Vite in dev; not a resolvable specifier at type-check time. */
const MODULE_URL = '/src/editors/preview/mermaid.ts';

/** An SVG with an arbitrary canvas around a rect of known position and size. */
const HARNESS = `
  (vx, vy, vw, vh, rx, ry, rw, rh) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1000px';
    host.innerHTML =
      '<svg width="100%" style="max-width: ' + vw + 'px;" ' +
      'viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + vh + '">' +
      '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="red"></rect>' +
      '</svg>';
    document.body.appendChild(host);
    return host;
  }
`;

type Box = [number, number, number, number];

async function repair(page: Page, canvas: Box, drawing: Box = [10, 10, 200, 100]) {
  return page.evaluate(
    async ({ harness, canvas, drawing, url }) => {
      const mod = (await import(/* @vite-ignore */ url)) as {
        refitDiagramCanvas: (host: HTMLElement) => { from: number[]; to: number[] } | null;
      };
      const build = eval(harness) as (...a: number[]) => HTMLElement;
      const host = build(...canvas, ...drawing);
      const result = mod.refitDiagramCanvas(host);
      const svg = host.querySelector('svg')!;
      const after = svg.getAttribute('viewBox');
      const cap = svg.style.maxWidth;
      const stamp = svg.dataset.refit;
      host.remove();
      return { result, after, cap, stamp };
    },
    { harness: HARNESS, canvas, drawing, url: MODULE_URL },
  );
}

test.describe('diagram canvas repair (FR-5.9)', () => {
  test('re-fits a canvas an order of magnitude too large', async ({ page }) => {
    await page.goto('/');
    const { result, after, cap } = await repair(page, [0, 0, 16518, 16439]);

    expect(result).not.toBeNull();
    // Content is the 200x100 rect at (10,10), plus 2px padding either side.
    expect(after).toBe('8 8 204 104');
    // The stale cap advertised a bogus natural width; it must follow.
    expect(cap).toBe('204px');
  });

  test('re-fits a misplaced canvas that clips the drawing', async ({ page }) => {
    await page.goto('/');
    // The reported shape, verbatim: canvas offset up-and-left of the drawing,
    // leaving the bottom 48 units outside the viewport and therefore cut.
    const { result, after } = await repair(
      page,
      [-122.55208587646484, -52.73333740234375, 876.96484375, 371.600341796875],
      [8, 8, 744, 359],
    );

    expect(result).not.toBeNull();
    expect(after).toBe('6 6 748 363');

    // The whole drawing now sits inside the canvas — nothing is cut.
    const [x, y, w, h] = (after ?? '').split(/\s+/).map(Number);
    expect(x).toBeLessThanOrEqual(8);
    expect(y).toBeLessThanOrEqual(8);
    expect(x + w).toBeGreaterThanOrEqual(8 + 744);
    expect(y + h).toBeGreaterThanOrEqual(8 + 359);
  });

  test('leaves an honest canvas alone', async ({ page }) => {
    await page.goto('/');
    // Each of these encloses the 200x100 drawing at (10,10). 1.59x is the
    // widest honest gap measured across all 23 diagram types (C4, vertically);
    // most sit near 1.0. Nothing here may be touched.
    for (const canvas of [
      [8, 8, 204, 104], // snug
      [0, 0, 240, 130], // 1.2x / 1.3x
      [0, 0, 280, 165], // 1.4x / 1.65x
    ] as Box[]) {
      const { result, after } = await repair(page, canvas);
      expect(result).toBeNull();
      expect(after).toBe(`${canvas[0]} ${canvas[1]} ${canvas[2]} ${canvas[3]}`);
    }
  });

  test('never grows a canvas that its diagram overdraws', async ({ page }) => {
    await page.goto('/');
    // `gantt` genuinely paints wider than it declares. The drawing is outside
    // the canvas, so the clip check trips — but fitting would enlarge it, and
    // honouring that would shrink the chart to a sliver.
    const { result, after, stamp } = await repair(page, [0, 0, 60, 40]);
    expect(result).toBeNull();
    expect(stamp).toBe('skipped-would-grow');
    expect(after).toBe('0 0 60 40');
  });

  test('every stock diagram type survives the repair untouched', async ({ page }) => {
    await page.goto('/');
    const fired = await page.evaluate(async (url) => {
      const mod = (await import(/* @vite-ignore */ url)) as {
        renderMermaidToSvg: (code: string, dark: boolean) => Promise<string>;
        refitDiagramCanvas: (host: HTMLElement) => unknown;
      };
      const samples: Record<string, string> = {
        flowchart: 'flowchart LR\n  A-->B-->C',
        flowchartTB: 'flowchart TB\n  subgraph S["Grp"]\n    X["Node X"]\n  end\n  X-->Y["Y"]',
        sequence: 'sequenceDiagram\n  Alice->>Bob: Hi\n  Bob-->>Alice: Yo',
        class: 'classDiagram\n  Animal <|-- Duck',
        er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
        journey: 'journey\n  title My day\n  section Go\n    Wake: 5: Me',
        gantt: 'gantt\n  title A\n  section S\n  Task :a1, 2024-01-01, 30d',
        pie: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
        c4: 'C4Context\n  title S\n  Person(a, "A", "d")',
        mindmap: 'mindmap\n  root((mind))\n    A\n    B',
        timeline: 'timeline\n  title H\n  2020 : A\n  2021 : B',
        gitGraph: 'gitGraph\n  commit\n  branch dev\n  commit',
        quadrant:
          'quadrantChart\n  title R\n  x-axis Low --> High\n  y-axis L --> H\n  A: [0.3, 0.6]',
        sankey: 'sankey-beta\n\nA,B,10',
        xychart: 'xychart-beta\n  title "S"\n  x-axis [a, b]\n  y-axis "v" 0 --> 10\n  bar [5, 8]',
        block: 'block-beta\n  columns 2\n  A B',
        kanban: 'kanban\n  Todo\n    task1[Do it]',
        packet: 'packet-beta\n0-15: "Src"\n16-31: "Dst"',
        radar: 'radar-beta\n  axis a["A"], b["B"]\n  curve c["C"]{1, 2}',
        treemap: 'treemap-beta\n"Root"\n  "A": 10\n  "B": 20',
      };
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
      document.body.appendChild(host);
      const changed: string[] = [];
      for (const [name, code] of Object.entries(samples)) {
        host.innerHTML = await mod.renderMermaidToSvg(code, false);
        if (mod.refitDiagramCanvas(host) !== null) changed.push(name);
      }
      host.remove();
      return changed;
    }, MODULE_URL);
    expect(fired).toEqual([]);
  });
});
