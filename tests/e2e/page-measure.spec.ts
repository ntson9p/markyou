import { expect, test, type Page } from '@playwright/test';

import { pinMode } from './helpers';

/**
 * Resizable WYSIWYG page measure (§8.1 default 72ch, FR-2.3 persistence):
 * dragging either page edge widens/narrows the centred column symmetrically.
 */

const page$ = (page: Page) => page.getByTestId('wysiwyg-page');
const handle = (page: Page, side: 'left' | 'right') => page.getByTestId(`page-measure-${side}`);

async function newWysiwygDoc(page: Page) {
  await pinMode(page, 'wysiwyg');
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
}

async function width(page: Page) {
  return (await page$(page).boundingBox())!.width;
}

/** Drag a handle horizontally by `dx` px. */
async function drag(page: Page, side: 'left' | 'right', dx: number) {
  const box = (await handle(page, side).boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 120);
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 8 });
  await page.mouse.up();
}

test.describe('WYSIWYG page measure', () => {
  test('dragging an edge resizes the page symmetrically and the content reflows', async ({
    page,
  }) => {
    await newWysiwygDoc(page);
    const before = await width(page);
    const editorBefore = (await page.locator('.ProseMirror').boundingBox())!.width;
    const leftBefore = (await page$(page).boundingBox())!.x;

    // A centred page grows on both sides: +120px of drag ≈ +240px of width.
    await drag(page, 'right', 120);

    const after = await width(page);
    expect(after - before).toBeGreaterThan(200);
    expect(after - before).toBeLessThan(280);
    // Still centred: the left edge moved out by half the growth.
    const leftAfter = (await page$(page).boundingBox())!.x;
    expect(leftBefore - leftAfter).toBeCloseTo((after - before) / 2, 0);
    // The markdown content itself takes the new width.
    const editorAfter = (await page.locator('.ProseMirror').boundingBox())!.width;
    expect(editorAfter - editorBefore).toBeCloseTo(after - before, 0);

    // The readout only shows while dragging.
    await expect(page.getByTestId('page-measure-readout')).toBeHidden();
  });

  test('the left edge drags outward to widen too', async ({ page }) => {
    await newWysiwygDoc(page);
    const before = await width(page);
    await drag(page, 'left', -80);
    expect(await width(page)).toBeGreaterThan(before + 120);
  });

  test('the measure persists across a reload and resets on double-click', async ({ page }) => {
    await newWysiwygDoc(page);
    const before = await width(page);
    await drag(page, 'right', 100);
    const resized = await width(page);
    expect(resized).toBeGreaterThan(before);

    // Reload lands on the welcome screen (the document lives on disk, not in
    // the session); the persisted measure must survive it.
    await page.reload();
    await page.getByTestId('welcome-new').click();
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
    expect(await width(page)).toBeCloseTo(resized, 0);

    await handle(page, 'right').dblclick();
    expect(await width(page)).toBeCloseTo(before, 0);
  });

  test('the handle is keyboard operable (§a11y)', async ({ page }) => {
    await newWysiwygDoc(page);
    const before = await width(page);

    const right = handle(page, 'right');
    await right.focus();
    await expect(right).toHaveAttribute('aria-valuenow', '72');

    // Outward (right, on the right edge) widens; inward narrows again.
    await page.keyboard.press('ArrowRight');
    await expect(right).toHaveAttribute('aria-valuenow', '76');
    expect(await width(page)).toBeGreaterThan(before);
    await page.keyboard.press('ArrowLeft');
    await expect(right).toHaveAttribute('aria-valuenow', '72');

    await page.keyboard.press('Home');
    await expect(right).toHaveAttribute('aria-valuenow', '40');
    expect(await width(page)).toBeLessThan(before);
  });

  test('no resize handles on small screens (§8.2)', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 800 });
    await newWysiwygDoc(page);
    await expect(handle(page, 'left')).toHaveCount(0);
    await expect(handle(page, 'right')).toHaveCount(0);
  });
});
