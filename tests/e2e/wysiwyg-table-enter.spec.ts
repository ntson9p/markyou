import { expect, test, type Page } from '@playwright/test';

/**
 * Enter inside a table (FR-5.7). Live-typing behaviour, which is why the
 * seeded-markdown specs never covered it.
 */

const editor = (page: Page) => page.locator('.ProseMirror');
// `table.children` is the real grid — the table block also keeps an empty
// <table> in its .drag-preview, which comes first in document order.
const grid = (page: Page) => editor(page).locator('table.children');
const cells = (page: Page) => grid(page).locator('th, td');

async function docWithTable(page: Page) {
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  // Generous timeout: the WYSIWYG engine is a lazy chunk that the dev server
  // cold-compiles on first navigation under parallel load.
  await expect(editor(page)).toBeVisible({ timeout: 30000 });
  await editor(page).click();
  await page.getByRole('button', { name: 'Insert table' }).click();
  await expect(cells(page)).toHaveCount(9);
}

/** Which cell holds the caret, as `r<row>c<col>`, or `outside` when it left. */
function caretCell(page: Page) {
  return page.evaluate(() => {
    const node = document.getSelection()?.anchorNode ?? null;
    if (!node) return 'none';
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
    const cell = el?.closest('th,td');
    const row = cell?.closest('tr');
    const table = cell?.closest('table');
    if (!cell || !row || !table) return 'outside';
    const rows = Array.from(table.querySelectorAll('tr'));
    return `r${rows.indexOf(row)}c${Array.from(row.children).indexOf(cell)}`;
  });
}

test.describe('Table Enter navigation (FR-5.7)', () => {
  test('Enter moves to the cell below instead of jumping past the table', async ({ page }) => {
    await docWithTable(page);
    await cells(page).first().click();
    await expect.poll(() => caretCell(page)).toBe('r0c0');

    await page.keyboard.type('line one');
    await page.keyboard.press('Enter');
    await expect.poll(() => caretCell(page)).toBe('r1c0');
    await page.keyboard.type('line two');
    await page.keyboard.press('Enter');
    await expect.poll(() => caretCell(page)).toBe('r2c0');
    await page.keyboard.type('line three');

    // The column fills top-to-bottom and the table keeps its shape.
    await expect(grid(page).locator('tr')).toHaveCount(3);
    await expect(cells(page).nth(0)).toHaveText('line one');
    await expect(cells(page).nth(3)).toHaveText('line two');
    await expect(cells(page).nth(6)).toHaveText('line three');
    // The bug: the very first Enter appended a paragraph below the whole table
    // and left the two untouched rows behind.
    await expect(editor(page).locator('> p')).toHaveCount(0);
  });

  test('Enter in the last row still leaves the table', async ({ page }) => {
    await docWithTable(page);
    await cells(page).nth(6).click();
    await expect.poll(() => caretCell(page)).toBe('r2c0');
    await page.keyboard.press('Enter');

    await expect.poll(() => caretCell(page)).toBe('outside');
    await page.keyboard.type('after the table');
    await expect(editor(page).locator('p').last()).toHaveText('after the table');
    await expect(grid(page).locator('tr')).toHaveCount(3);
  });

  test('Ctrl+Enter still leaves the table from a middle row', async ({ page }) => {
    await docWithTable(page);
    await cells(page).nth(3).click();
    await expect.poll(() => caretCell(page)).toBe('r1c0');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect.poll(() => caretCell(page)).toBe('outside');
    await expect(grid(page).locator('tr')).toHaveCount(3);
  });

  test('Tab still moves to the next cell along', async ({ page }) => {
    await docWithTable(page);
    await cells(page).first().click();
    await expect.poll(() => caretCell(page)).toBe('r0c0');

    await page.keyboard.press('Tab');
    await expect.poll(() => caretCell(page)).toBe('r0c1');
  });
});
