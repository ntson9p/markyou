import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * Mermaid diagrams fill their column (FR-5.9).
 *
 * Mermaid stamps `width="100%"` plus an inline `style="max-width:<natural
 * layout width>px"` on every diagram it renders. The cap has nothing to do
 * with our column, and being inline it beats any stylesheet rule — so a
 * diagram used to stop growing partway across a widened page. `liftWidthCap`
 * rewrites the cap to twice the natural width: wide enough to fill a page,
 * tight enough that a two-node graph is not blown up to span it.
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

/** Per-diagram geometry: rendered width, the room it had, and its own cap. */
async function scan(page: Page, hostSelector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll<HTMLElement>(sel)].map((host) => {
      const svg = host.querySelector('svg')!;
      const style = getComputedStyle(host);
      const viewBox = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      return {
        width: Math.round(svg.getBoundingClientRect().width),
        available: Math.round(
          host.clientWidth -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight),
        ),
        natural: viewBox[2],
        cap: Number.parseFloat(/max-width:\s*([\d.]+)px/.exec(svg.getAttribute('style') ?? '')![1]),
      };
    });
  }, hostSelector);
}

test.describe('mermaid diagram width (FR-5.9)', () => {
  test('a wide diagram fills the page and follows the page measure', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    // Mermaid is a lazy chunk; both diagrams resolve once it loads.
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [wide] = await scan(page, '.diagram-node');
    // The column is wider than the diagram's natural width — before the fix it
    // stopped at `natural` and left the rest of the page empty.
    expect(wide.available).toBeGreaterThan(wide.natural);
    expect(wide.width).toBeCloseTo(wide.available, -1);

    // Narrow the measure: the diagram follows it back down.
    await page.getByTestId('page-measure-right').focus();
    for (let i = 0; i < 16; i += 1) await page.keyboard.press('ArrowLeft'); // 160 → 96ch
    const [narrowed] = await scan(page, '.diagram-node');
    expect(narrowed.available).toBeLessThan(wide.available);
    expect(narrowed.width).toBeCloseTo(narrowed.available, -1);
  });

  test('a two-node diagram is not inflated to span the column', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [, tiny] = await scan(page, '.diagram-node');
    // Room to grow, deliberately not taken beyond the cap.
    expect(tiny.available).toBeGreaterThan(tiny.natural * 4);
    expect(tiny.width).toBeLessThanOrEqual(Math.ceil(tiny.natural * 2) + 1);
    expect(tiny.width).toBeLessThan(tiny.available / 3);
  });

  test('the cap is lifted, not removed', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    // Every diagram keeps a bounded cap at exactly twice its natural width —
    // dropping the cap entirely is what would inflate the small one.
    for (const d of await scan(page, '.diagram-node')) {
      expect(d.cap).toBeCloseTo(d.natural * 2, 3);
    }
  });

  test('a diagram narrower than the column never overflows it', async ({ page }) => {
    await open(page, 'wysiwyg', 72); // default: narrower than the wide diagram
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [wide] = await scan(page, '.diagram-node');
    expect(wide.available).toBeLessThan(wide.natural); // must scale down to fit
    expect(wide.width).toBeLessThanOrEqual(wide.available + 1);

    // Measured on the content column: the page's own box overflows by design,
    // the measure handles living in the gutter either side of it.
    const overflow = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror') as HTMLElement;
      return pm.scrollWidth - pm.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the preview shares the same sizing', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.locator('.md-doc .mermaid-diagram svg')).toHaveCount(2, { timeout: 30000 });

    const [wide, tiny] = await scan(page, '.md-doc .mermaid-diagram');
    // The preview column is fixed at 72ch — narrower than the wide diagram, so
    // it fills either way. The lifted cap is what proves the shared render
    // path (and not per-surface CSS) is doing the work here too.
    expect(wide.cap).toBeCloseTo(wide.natural * 2, 3);
    expect(wide.width).toBeCloseTo(wide.available, -1);
    // …and the small one is still left alone.
    expect(tiny.width).toBeLessThanOrEqual(Math.ceil(tiny.natural * 2) + 1);
  });
});
