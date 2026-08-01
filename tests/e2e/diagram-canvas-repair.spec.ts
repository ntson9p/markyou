import { expect, test } from '@playwright/test';

/**
 * Repair for a diagram whose declared canvas does not match what it draws
 * (FR-5.9).
 *
 * Mermaid lays out off-screen and bakes the resulting bounds into `viewBox`.
 * That measurement can come out an order of magnitude too large — a
 * `foreignObject` label that has not been laid out reports a clamped 16384px,
 * and the canvas grows to enclose it. The drawing is fine, but it is scaled to
 * a few percent to fit, so the diagram appears microscopic. Reported from the
 * field as `viewBox: -132 -53 16518 16439` around a ~700px drawing: 5.3%.
 *
 * The repair must shrink only, and must never fire on an honest canvas — some
 * diagram types carry real margin, and `gantt` draws *past* its own canvas.
 */

/** Served by Vite in dev; not a resolvable specifier at type-check time. */
const MODULE_URL = '/src/editors/preview/mermaid.ts';

/** Build an SVG with a chosen canvas around a fixed 200x100 drawing. */
const HARNESS = `
  (declaredW, declaredH) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1000px';
    host.innerHTML =
      '<svg width="100%" style="max-width: ' + declaredW + 'px;" ' +
      'viewBox="0 0 ' + declaredW + ' ' + declaredH + '">' +
      '<rect x="10" y="10" width="200" height="100" fill="red"></rect></svg>';
    document.body.appendChild(host);
    return host;
  }
`;

async function repair(page: import('@playwright/test').Page, w: number, h: number) {
  return page.evaluate(
    async ({ harness, w, h, url }) => {
      const mod = (await import(/* @vite-ignore */ url)) as {
        refitOversizedCanvas: (host: HTMLElement) => { from: number[]; to: number[] } | null;
      };
      const host = (eval(harness) as (a: number, b: number) => HTMLElement)(w, h);
      const result = mod.refitOversizedCanvas(host);
      const svg = host.querySelector('svg')!;
      const after = svg.getAttribute('viewBox');
      const cap = svg.style.maxWidth;
      host.remove();
      return { result, after, cap };
    },
    { harness: HARNESS, w, h, url: MODULE_URL },
  );
}

test.describe('oversized canvas repair (FR-5.9)', () => {
  test('re-fits a canvas an order of magnitude too large', async ({ page }) => {
    await page.goto('/');
    // The reported shape: a ~200x100 drawing on a 16384-ish canvas.
    const { result, after, cap } = await repair(page, 16518, 16439);

    expect(result).not.toBeNull();
    // Content is the 200x100 rect at (10,10), plus 2px padding either side.
    expect(after).toBe('8 8 204 104');
    // The stale cap advertised a bogus natural width; it must follow.
    expect(cap).toBe('204px');
  });

  test('leaves an honest canvas alone', async ({ page }) => {
    await page.goto('/');
    // 1.59x is the widest honest gap measured across all 23 diagram types
    // (C4, vertically); most sit near 1.0. Nothing here may be touched.
    for (const [w, h] of [
      [204, 104],
      [240, 130],
      [280, 165],
    ] as const) {
      const { result, after } = await repair(page, w, h);
      expect(result).toBeNull();
      expect(after).toBe(`0 0 ${w} ${h}`);
    }
  });

  test('never grows a canvas that its diagram overdraws', async ({ page }) => {
    await page.goto('/');
    // `gantt` genuinely paints wider than it declares; growing to meet the
    // drawing would be a regression, so the repair is shrink-only.
    const { result, after } = await repair(page, 60, 40);
    expect(result).toBeNull();
    expect(after).toBe('0 0 60 40');
  });

  test('every stock diagram type survives the repair untouched', async ({ page }) => {
    await page.goto('/');
    const untouched = await page.evaluate(async (url) => {
      const mod = (await import(/* @vite-ignore */ url)) as {
        renderMermaidToSvg: (code: string, dark: boolean) => Promise<string>;
        refitOversizedCanvas: (host: HTMLElement) => unknown;
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
      };
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1200px';
      document.body.appendChild(host);
      const fired: string[] = [];
      for (const [name, code] of Object.entries(samples)) {
        host.innerHTML = await mod.renderMermaidToSvg(code, false);
        if (mod.refitOversizedCanvas(host) !== null) fired.push(name);
      }
      host.remove();
      return fired;
    }, MODULE_URL);
    expect(untouched).toEqual([]);
  });
});
