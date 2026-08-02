import { expect, test } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * Diagram labels are SVG text, never HTML in a `<foreignObject>` (FR-5.9).
 *
 * With HTML labels mermaid measures each one via `getBoundingClientRect()` —
 * CSS pixels — then uses the result as SVG user units. That equivalence holds
 * only at scale 1, and when it breaks the node boxes inflate while the text
 * inside them stays true size: the layout comes out ~20× too large and scales
 * down to an unreadable smudge. Reported from the field as a 16902×8478 layout
 * for a diagram that measures 701×396 with SVG text labels.
 *
 * `<text>` is measured with `getBBox()` in user units, so no conversion is
 * involved and the failure mode cannot arise.
 */

const DOC = [
  '### Labels',
  '',
  '```mermaid',
  'flowchart LR',
  '  subgraph WhenOFF["Checkbox OFF (default)"]',
  '    N1["N = 1<br/>Same as today"]',
  '  end',
  '  subgraph WhenON["Checkbox ON"]',
  '    Ncalc["N = parent slots<br/>+ sum of selected option slots"]',
  '    Example["Example: parent 1 + 胃カメラ 1 + マンモ 1<br/>⇒ N = 3 at 15 min/slot ⇒ 45 min"]',
  '  end',
  '  WhenOFF -.->|unchanged| Today["One slot per booking"]',
  '  WhenON --> Ncalc --> Example',
  '```',
  '',
  '```mermaid',
  'flowchart TB',
  '  subgraph Engine["Booking engine"]',
  '    FS["Frame settings & forms"]',
  '    Mongo[("MongoDB")]',
  '  end',
  '  FS --> Mongo',
  '```',
  '',
].join('\n');

test.describe('diagram labels (FR-5.9)', () => {
  test('labels render as SVG text, with no foreignObject anywhere', async ({ page }) => {
    await pinMode(page, 'wysiwyg');
    await stubFsa(page);
    await seedFakeFile(page, 'labels.md', DOC);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    // The measurement path that inflates layouts must not be present at all.
    await expect(page.locator('.diagram-node svg foreignObject')).toHaveCount(0);
    expect(await page.locator('.diagram-node svg text').count()).toBeGreaterThan(0);
  });

  test('non-ASCII text and <br/> breaks survive the switch', async ({ page }) => {
    await pinMode(page, 'wysiwyg');
    await stubFsa(page);
    await seedFakeFile(page, 'labels.md', DOC);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.diagram-node svg').first()).toBeVisible({ timeout: 30000 });

    const first = page.locator('.diagram-node').first();
    await expect(first).toContainText('胃カメラ');
    await expect(first).toContainText('マンモ');
    // `<br/>` becomes multiple tspans rather than a literal in the label.
    await expect(first).not.toContainText('<br/>');
    const lines = await first.locator('svg text tspan').count();
    expect(lines).toBeGreaterThan(1);
  });

  test('the layout stays a sane size for its content', async ({ page }) => {
    await pinMode(page, 'wysiwyg');
    await stubFsa(page);
    await seedFakeFile(page, 'labels.md', DOC);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.diagram-node svg')).toHaveCount(2, { timeout: 30000 });

    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll('.diagram-node svg')].map((s) => {
        const vb = (s.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
        return { w: vb[2], h: vb[3] };
      }),
    );
    // An inflated layout is the failure this guards; a handful of nodes can
    // never legitimately need thousands of units.
    for (const b of boxes) {
      expect(b.w).toBeLessThan(2000);
      expect(b.h).toBeLessThan(2000);
    }
  });
});
