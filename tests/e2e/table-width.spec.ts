import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * Tables fill their column and scroll on their own when too wide (FR-4.4:
 * preview, WYSIWYG and export share one table presentation).
 *
 * `display: block` on a table — the classic horizontal-scroll trick — leaves
 * the rows in an anonymous shrink-to-fit box, so `width: 100%` does nothing
 * and a table ignores the width of the column it sits in.
 */

const DOC = [
  '## Glossary',
  '',
  'A paragraph, for comparison with the table width below.',
  '',
  '| Term | Meaning |',
  '| --- | --- |',
  '| slot | One bookable time cell |',
  '| frame | A settings document |',
  '',
  '| A | B | C | D | E | F | G | H | I | J | K | L |',
  '| - | - | - | - | - | - | - | - | - | - | - | - |',
  '| wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww | wwwwwwwwww |',
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
  await seedFakeFile(page, 'tables.md', DOC);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
}

/** Width of the visible table — the row box, not the element box. */
async function rowWidth(page: Page, nth: number) {
  return page.evaluate(
    (i) => Math.round(document.querySelectorAll('tr')[i]!.getBoundingClientRect().width),
    nth,
  );
}

test.describe('table width (FR-4.4)', () => {
  test('a WYSIWYG table fills the page and follows the page measure', async ({ page }) => {
    await open(page, 'wysiwyg', 120);
    await expect(page.locator('.ProseMirror table.children').first()).toBeVisible({
      timeout: 30000,
    });

    const paragraph = await page.evaluate(() =>
      Math.round(document.querySelector('.ProseMirror p')!.getBoundingClientRect().width),
    );
    const wide = await rowWidth(page, 0);
    expect(wide).toBeCloseTo(paragraph, -1); // fills the widened page

    // Narrow the measure: the table follows it down again.
    await page.getByTestId('page-measure-right').focus();
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowLeft'); // 120 → 88ch
    const narrowedParagraph = await page.evaluate(() =>
      Math.round(document.querySelector('.ProseMirror p')!.getBoundingClientRect().width),
    );
    expect(narrowedParagraph).toBeLessThan(paragraph);
    expect(await rowWidth(page, 0)).toBeCloseTo(narrowedParagraph, -1);
  });

  test('a preview table fills the column; an over-wide one scrolls itself', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.locator('.md-doc table').first()).toBeVisible({ timeout: 30000 });

    const geometry = await page.evaluate(() => {
      const doc = document.querySelector('.md-doc') as HTMLElement;
      const wrappers = [...document.querySelectorAll<HTMLElement>('.md-table-scroll')];
      const rows = [...document.querySelectorAll('tr')];
      return {
        wrappers: wrappers.length,
        docWidth: Math.round(doc.getBoundingClientRect().width),
        // Table 1 is narrow: it should stretch to the wrapper width.
        narrowRow: Math.round(rows[0]!.getBoundingClientRect().width),
        narrowWrapper: Math.round(wrappers[0]!.getBoundingClientRect().width),
        // Table 2 is over-wide: it scrolls inside its own wrapper…
        wideScrolls: wrappers[1]!.scrollWidth > wrappers[1]!.clientWidth,
        wideWrapperWidth: Math.round(wrappers[1]!.getBoundingClientRect().width),
        // …and must not push the document sideways.
        docScrollsHorizontally: doc.scrollWidth > doc.clientWidth,
      };
    });

    expect(geometry.wrappers).toBe(2);
    expect(geometry.narrowRow).toBeCloseTo(geometry.narrowWrapper, -1);
    expect(geometry.wideScrolls).toBe(true);
    expect(geometry.wideWrapperWidth).toBeLessThanOrEqual(geometry.docWidth);
    expect(geometry.docScrollsHorizontally).toBe(false);
  });

  test('resizing after hovering a table leaves no phantom scrollbar', async ({ page }) => {
    await open(page, 'wysiwyg', 140);
    const table = page.locator('.ProseMirror table.children').first();
    await expect(table).toBeVisible({ timeout: 30000 });

    // Arm both insertion-line handles: they cache absolute geometry measured
    // against the *current* table width, and only recompute it on a hover.
    const cell = (await page.locator('.ProseMirror td').first().boundingBox())!;
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height - 2); // row boundary
    await page.waitForTimeout(150);
    await page.mouse.move(cell.x + cell.width - 2, cell.y + cell.height / 2); // column boundary
    await page.waitForTimeout(150);
    // Leave the table so the handles hide (but keep their inline geometry).
    await page.mouse.move(20, 20);
    await page.waitForTimeout(300);

    // Narrow the page well below the width the handles were measured at.
    await page.getByTestId('page-measure-right').focus();
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);

    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.table-wrapper')].map((w) => ({
        horizontal: w.scrollWidth - w.clientWidth,
        vertical: w.scrollHeight - w.clientHeight,
      })),
    );
    // Hidden chrome must not make the table scrollable.
    for (const o of overflow) {
      expect(o.horizontal).toBe(0);
      expect(o.vertical).toBe(0);
    }
  });

  test('the insertion line still lands on the boundary it marks', async ({ page }) => {
    await open(page, 'wysiwyg', 100);
    await expect(page.locator('.ProseMirror table.children').first()).toBeVisible({
      timeout: 30000,
    });

    // Guards the fix's shape: hiding the handles with `display: none` would
    // also stop the overflow, but it detaches offsetParent and floating-ui
    // then places the affordance hundreds of pixels away.
    const row = (await page.locator('.ProseMirror tbody tr').nth(1).boundingBox())!;
    await page.mouse.move(row.x + row.width / 2, row.y + 2);
    await page.waitForTimeout(250);

    // The hovered row belongs to the first table; scope to its handle (each
    // table block renders its own).
    const firstTable = page.locator('.milkdown-table-block').first();
    const placement = await page.evaluate((rowTop) => {
      const handle = document
        .querySelector('.milkdown-table-block')!
        .querySelector('[data-role="x-line-drag-handle"]') as HTMLElement;
      return {
        shown: handle.dataset.show,
        offBy: Math.round(handle.getBoundingClientRect().top - rowTop),
      };
    }, row.y);
    expect(placement.shown).toBe('true');
    expect(Math.abs(placement.offBy)).toBeLessThanOrEqual(2);

    // …and the affordance still works.
    const before = await firstTable.locator('table.children tr').count();
    await firstTable.locator('[data-role="x-line-drag-handle"] .add-button').click();
    await expect(firstTable.locator('table.children tr')).toHaveCount(before + 1);
  });

  test('scroll-sync anchors survive the wrapper', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.locator('.md-doc table').first()).toBeVisible({ timeout: 30000 });
    // The stamp stays on the table; the wrapper must not duplicate the line.
    await expect(page.locator('.md-doc table[data-sourcepos]')).toHaveCount(2);
    await expect(page.locator('.md-table-scroll[data-sourcepos]')).toHaveCount(0);
  });
});
