import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * Mermaid diagrams size to their column (FR-5.9).
 *
 * Mermaid stamps `width="100%"` plus an inline `style="max-width:<natural
 * layout width>px"` on every diagram, and an inline style beats any rule we
 * could write. That bound is wrong at both ends: the diagram stalls partway
 * across a widened page, and in a column narrower than its natural width it is
 * squeezed below legibility — 16px labels painting at 11.5px next to 16px
 * prose. `fitDiagramWidth` rewrites the bounds to clamp instead:
 *
 *     width = clamp(natural, column, 2 × natural)
 */

const WIDE = [
  '```mermaid',
  'flowchart LR',
  '  subgraph OFF["Checkbox OFF (default)"]',
  '    N1["N = 1<br/>Same as today"]',
  '  end',
  '  subgraph ON["Checkbox ON"]',
  '    Ncalc["N = parent slots<br/>+ sum of selected option slots"]',
  '    Ex["Example: parent 1 + scope 1 + scan 1<br/>=> N = 3 at 15 min/slot => 45 min block"]',
  '  end',
  '  OFF -.->|unchanged| Today["One slot per booking"]',
  '  ON --> Ncalc --> Ex',
  '```',
].join('\n');

const DOC = [
  '## Diagrams',
  '',
  'A paragraph, for comparison with the diagram width below.',
  '',
  WIDE,
  '',
  '```mermaid',
  'graph TD;',
  '  A-->B;',
  '```',
  '',
].join('\n');

async function open(page: Page, mode: 'wysiwyg' | 'raw', measure?: number) {
  await pinMode(page, mode);
  if (measure !== undefined) {
    await page.addInitScript((ch) => {
      const raw = window.localStorage.getItem('markyou.ui');
      const persisted = raw ? JSON.parse(raw) : { state: {} };
      persisted.state = { ...persisted.state, wysiwygMeasure: ch };
      window.localStorage.setItem('markyou.ui', JSON.stringify({ version: 0, ...persisted }));
    }, measure);
  }
  await stubFsa(page);
  await seedFakeFile(page, 'diagrams.md', DOC);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
}

/** Rendered width, the room it had, its bounds, and how its host scrolls. */
async function scan(page: Page, hostSelector: string) {
  return page.evaluate((sel) => {
    const bound = (style: string, prop: string) =>
      Number.parseFloat(new RegExp(`(?:^|;)\\s*${prop}:\\s*([\\d.]+)px`).exec(style)?.[1] ?? 'NaN');
    return [...document.querySelectorAll<HTMLElement>(sel)].map((host) => {
      const svg = host.querySelector('svg')!;
      const css = getComputedStyle(host);
      const inline = svg.getAttribute('style') ?? '';
      const viewBox = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      return {
        width: Math.round(svg.getBoundingClientRect().width),
        available: Math.round(
          host.clientWidth -
            Number.parseFloat(css.paddingLeft) -
            Number.parseFloat(css.paddingRight),
        ),
        natural: viewBox[2],
        ceiling: bound(inline, 'max-width'),
        floor: bound(inline, 'min-width'),
        scrollX: host.scrollWidth - host.clientWidth,
        scrollY: host.scrollHeight - host.clientHeight,
      };
    });
  }, hostSelector);
}

test.describe('mermaid diagram width (FR-5.9)', () => {
  test('a wide diagram fills a widened page and follows the measure', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    // Mermaid is a lazy chunk; both diagrams resolve once it loads.
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [wide] = await scan(page, '.diagram-node');
    // The column is wider than the diagram's natural width — before the fix it
    // stopped at `natural` and left the rest of the page empty.
    expect(wide.available).toBeGreaterThan(wide.natural);
    expect(wide.width).toBeCloseTo(wide.available, -1);
    expect(wide.scrollX).toBe(0); // nothing to scroll when it fits

    // Narrow the measure: the diagram follows it back down.
    await page.getByTestId('page-measure-right').focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowLeft'); // 160 → 128ch
    const [narrowed] = await scan(page, '.diagram-node');
    expect(narrowed.available).toBeLessThan(wide.available);
    expect(narrowed.available).toBeGreaterThan(narrowed.natural); // still room to fill
    expect(narrowed.width).toBeCloseTo(narrowed.available, -1);
  });

  test('a diagram too wide for the column keeps its natural size and scrolls', async ({ page }) => {
    await open(page, 'wysiwyg', 72); // the default measure, narrower than the diagram
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [wide] = await scan(page, '.diagram-node');
    expect(wide.available).toBeLessThan(wide.natural);
    // Holds natural size — shrinking to 0.72× is what made the labels smaller
    // than the prose beside them.
    expect(wide.width).toBe(Math.round(wide.natural));
    expect(wide.scrollX).toBeGreaterThan(0);
    // Scrolling sideways must not also make it scroll vertically.
    expect(wide.scrollY).toBe(0);

    // The overflow is contained: the document itself does not scroll sideways.
    const columnOverflow = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement;
      return pm.scrollWidth - pm.clientWidth;
    });
    expect(columnOverflow).toBeLessThanOrEqual(1);
  });

  test('a two-node diagram is not inflated to span the column', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [, tiny] = await scan(page, '.diagram-node');
    // Room to grow, deliberately not all taken.
    expect(tiny.available).toBeGreaterThan(tiny.natural * 4);
    expect(tiny.width).toBeLessThanOrEqual(Math.ceil(tiny.natural * 2) + 1);
    expect(tiny.width).toBeLessThan(tiny.available / 3);
  });

  test('the bounds clamp: a floor at natural, a ceiling at twice it', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    // Dropping the ceiling would inflate the small diagram; dropping the floor
    // is what let a wide one be squeezed below its type size.
    for (const d of await scan(page, '.diagram-node')) {
      expect(d.floor).toBeCloseTo(d.natural, 3);
      expect(d.ceiling).toBeCloseTo(d.natural * 2, 3);
    }
  });

  test('the preview shares the same sizing', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.locator('.md-doc .mermaid-diagram svg')).toHaveCount(2, { timeout: 30000 });

    const [wide, tiny] = await scan(page, '.md-doc .mermaid-diagram');
    // The preview column is fixed at 72ch, so the wide diagram overflows it and
    // scrolls in its own wrapper rather than shrinking…
    expect(wide.available).toBeLessThan(wide.natural);
    expect(wide.width).toBe(Math.round(wide.natural));
    expect(wide.scrollX).toBeGreaterThan(0);
    // …and the small one is still left alone.
    expect(tiny.width).toBeLessThanOrEqual(Math.ceil(tiny.natural * 2) + 1);

    // The article must not be pushed sideways by either.
    const docOverflow = await page.evaluate(() => {
      const doc = document.querySelector('.md-doc') as HTMLElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(docOverflow).toBeLessThanOrEqual(1);
  });
});
