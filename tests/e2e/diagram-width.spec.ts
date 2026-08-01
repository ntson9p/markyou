import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * Mermaid diagrams size to their column (FR-5.9).
 *
 * The rule is deliberately mermaid's own: `width="100%"` with an inline
 * `max-width:<natural layout width>px`, so a diagram fills the column it is
 * given and is **never scaled up** past the size its own text metrics
 * produced — 16px labels stay 16px rather than ballooning on a widened page.
 * Too wide for the column and it scales down; too tall and `max-height` scales
 * it down as well, since an SVG carries an intrinsic ratio. No scrollbars: a
 * diagram is read as a whole.
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

/** Tall and narrow — the axis `max-height` guards. */
const TALL = [
  '## Tall',
  '',
  '```mermaid',
  'flowchart TD',
  ...Array.from({ length: 22 }, (_, i) => `  N${i}["Node ${i}"] --> N${i + 1}`),
  '```',
  '',
].join('\n');

async function open(page: Page, mode: 'wysiwyg' | 'raw', measure?: number, body = DOC) {
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
  await seedFakeFile(page, 'diagrams.md', body);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
}

/** Rendered size, the room it had, its natural size, and any overflow. */
async function scan(page: Page, hostSelector: string) {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll<HTMLElement>(sel)].map((host) => {
      const svg = host.querySelector('svg')!;
      const css = getComputedStyle(host);
      const box = svg.getBoundingClientRect();
      const viewBox = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        available: Math.round(
          host.clientWidth -
            Number.parseFloat(css.paddingLeft) -
            Number.parseFloat(css.paddingRight),
        ),
        natural: viewBox[2],
        naturalH: viewBox[3],
        scrollX: host.scrollWidth - host.clientWidth,
        scrollY: host.scrollHeight - host.clientHeight,
      };
    });
  }, hostSelector);
}

test.describe('mermaid diagram width (FR-5.9)', () => {
  test('a diagram too wide for the column scales down to fit', async ({ page }) => {
    await open(page, 'wysiwyg', 72); // the default measure, narrower than the diagram
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const [wide] = await scan(page, '.diagram-node');
    expect(wide.available).toBeLessThan(wide.natural);
    expect(wide.width).toBeCloseTo(wide.available, -1);
    // Scaled, not clipped: nothing scrolls and the aspect ratio is kept.
    expect(wide.scrollX).toBe(0);
    expect(wide.height).toBeCloseTo((wide.width * wide.naturalH) / wide.natural, -1);
  });

  test('a diagram is never scaled up past its natural size', async ({ page }) => {
    await open(page, 'wysiwyg', 160); // far wider than either diagram
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    for (const d of await scan(page, '.diagram-node')) {
      expect(d.available).toBeGreaterThan(d.natural); // room going spare
      expect(d.width).toBe(Math.round(d.natural)); // deliberately not taken
    }
  });

  test('a diagram follows the page measure back down', async ({ page }) => {
    await open(page, 'wysiwyg', 160);
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });
    const [wide] = await scan(page, '.diagram-node');

    await page.getByTestId('page-measure-right').focus();
    for (let i = 0; i < 24; i += 1) await page.keyboard.press('ArrowLeft'); // 160 → 64ch
    const [narrowed] = await scan(page, '.diagram-node');

    expect(narrowed.available).toBeLessThan(narrowed.natural); // now the binding limit
    expect(narrowed.width).toBeLessThan(wide.width);
    expect(narrowed.width).toBeCloseTo(narrowed.available, -1);
  });

  test('a very tall diagram is scaled down by the height cap, not scrolled', async ({ page }) => {
    await open(page, 'wysiwyg', 72, TALL);
    await expect(page.locator('.diagram-node svg')).toBeVisible({ timeout: 30000 });

    const [tall] = await scan(page, '.diagram-node');
    const capPx = await page.evaluate(() => window.innerHeight * 0.7);
    expect(tall.naturalH).toBeGreaterThan(capPx); // genuinely taller than the cap
    expect(tall.height).toBeLessThanOrEqual(Math.ceil(capPx) + 1);
    // Scaled uniformly — width came down with it, and nothing scrolls.
    expect(tall.width).toBeLessThan(tall.natural);
    expect(tall.scrollY).toBe(0);
    expect(tall.scrollX).toBe(0);
  });

  test('the preview shares the same sizing', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.locator('.md-doc .mermaid-diagram svg')).toHaveCount(2, { timeout: 30000 });

    const [wide, tiny] = await scan(page, '.md-doc .mermaid-diagram');
    // Wide one scales to the 72ch column…
    expect(wide.available).toBeLessThan(wide.natural);
    expect(wide.width).toBeCloseTo(wide.available, -1);
    // …the small one keeps its natural size rather than stretching.
    expect(tiny.width).toBe(Math.round(tiny.natural));

    const docOverflow = await page.evaluate(() => {
      const doc = document.querySelector('.md-doc') as HTMLElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(docOverflow).toBeLessThanOrEqual(1);
  });

  test('a long code line does not push the page off-screen', async ({ page }) => {
    // The editor pane is a row flex item; without `min-w-0` its automatic
    // minimum is the min-content width of the widest block, which stretches the
    // pane past the window and slides the page out of view (AppShell).
    const long = ['## Head', '', '```js', `const x = "${'y'.repeat(600)}";`, '```', ''].join('\n');
    await open(page, 'wysiwyg', 72, long);
    await expect(page.locator('.milkdown-code-block')).toBeVisible({ timeout: 30000 });

    const blownOutBy = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(blownOutBy).toBe(0);
  });
});
