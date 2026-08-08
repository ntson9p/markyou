import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * The splitter sizes the rendered document (FR-2.4).
 *
 * Raw-mode preview and the dual-mode rich pane fill their column — no
 * typographic measure cap, so dragging the divider changes the width of the
 * text itself rather than just the empty gutter around it. (The ~72ch measure
 * is WYSIWYG single mode's centred page, §8.1, which has no divider; see
 * page-measure.spec.ts.)
 */

const DOC = [
  '# Split width',
  '',
  'A paragraph long enough that a capped measure would wrap it well before the',
  'column edge, which is exactly what these assertions are watching for.',
  '',
].join('\n');

async function open(page: Page, mode: 'raw' | 'dual') {
  await stubFsa(page);
  await seedFakeFile(page, 'split.md', DOC);
  await pinMode(page, mode);
  // Wide enough that a 72ch cap binds well inside the pane whatever a `ch`
  // measures in the document font.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
}

/** Drag the split divider horizontally by `dx` px (negative widens the right pane). */
async function dragDivider(page: Page, dx: number) {
  const box = (await page.getByTestId('split-divider').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 8 });
  await page.mouse.up();
}

/** Rendered content width alongside the room its scroll column gives it. */
async function measure(page: Page, contentId: string, columnId: string) {
  return page.evaluate(
    ([content, column]) => ({
      content: document.querySelector<HTMLElement>(`[data-testid="${content}"]`)!.clientWidth,
      column: document.querySelector<HTMLElement>(`[data-testid="${column}"]`)!.clientWidth,
    }),
    [contentId, columnId] as const,
  );
}

test.describe('splitter sizes the rendered column (FR-2.4)', () => {
  test('the raw-mode preview fills its column and follows the divider', async ({ page }) => {
    await open(page, 'raw');
    await expect(page.getByTestId('preview').locator('h1')).toHaveText('Split width');

    const before = await measure(page, 'preview-doc', 'preview');
    expect(before.content).toBe(before.column); // no measure cap

    await dragDivider(page, -240); // widen the preview
    const wider = await measure(page, 'preview-doc', 'preview');
    expect(wider.content).toBe(wider.column);
    expect(wider.content - before.content).toBeCloseTo(240, -1);

    await dragDivider(page, 300); // and back the other way
    const narrower = await measure(page, 'preview-doc', 'preview');
    expect(narrower.content).toBe(narrower.column);
    expect(narrower.content).toBeLessThan(before.content);
  });

  test('the dual-mode rich pane fills its column and follows the divider', async ({ page }) => {
    await open(page, 'dual');
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });

    const before = await measure(page, 'dual-wysiwyg-page', 'dual-wysiwyg-pane');
    expect(before.content).toBe(before.column); // no measure cap

    await dragDivider(page, -240); // widen the rich pane
    const wider = await measure(page, 'dual-wysiwyg-page', 'dual-wysiwyg-pane');
    expect(wider.content).toBe(wider.column);
    expect(wider.content - before.content).toBeCloseTo(240, -1);

    // The editable surface takes the new width, not just its wrapper.
    // Tolerance absorbs sub-pixel layout; a reinstated cap would be ~270px off.
    const editor = (await page.locator('.ProseMirror').boundingBox())!.width;
    expect(editor).toBeCloseTo(wider.content - 48, -1); // px-6 either side
  });
});
