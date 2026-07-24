import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

const PHONE = { width: 390, height: 780 };
const DOC = '# Title\n\n## Section A\n\nAlpha.\n\n## Section B\n\nBeta.\n';

async function openDoc(page: Page, mode: 'raw' | 'wysiwyg' | 'dual', content = DOC) {
  await stubFsa(page);
  await seedFakeFile(page, 'doc.md', content);
  await pinMode(page, mode);
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
}

test.describe('responsive shell (§8.2)', () => {
  test('small screens drop Dual from the mode switcher (D4)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openDoc(page, 'wysiwyg');
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });

    await expect(page.getByRole('radio', { name: 'Raw' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'WYSIWYG' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Dual' })).toHaveCount(0);
  });

  test('a persisted Dual mode renders single-pane on small screens', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openDoc(page, 'dual');
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });

    // No side-by-side raw pane, no dual split.
    await expect(page.getByTestId('dual-wysiwyg-pane')).toHaveCount(0);
    await expect(page.locator('.cm-editor')).toHaveCount(0);
  });

  test('outline is an overlay drawer on small screens, dismissed by backdrop', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openDoc(page, 'wysiwyg');
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('outline-toggle').click();
    await expect(page.getByTestId('outline')).toBeVisible();
    await expect(page.getByTestId('outline-backdrop')).toBeVisible();

    // Selecting a heading closes the drawer and keeps editing in view.
    await page.getByTestId('outline').getByRole('button', { name: 'Section B' }).click();
    await expect(page.getByTestId('outline')).toHaveCount(0);
  });

  test('outline is an inline sidebar on desktop (no backdrop)', async ({ page }) => {
    await openDoc(page, 'wysiwyg'); // default desktop viewport
    await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('outline-toggle').click();
    await expect(page.getByTestId('outline')).toBeVisible();
    await expect(page.getByTestId('outline-backdrop')).toHaveCount(0);
  });

  test('raw preview replaces the source pane on small screens (§8.2)', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openDoc(page, 'raw');

    // Preview defaults on; on mobile it takes over the whole pane (no split).
    await expect(page.getByTestId('raw-preview-full')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.cm-content')).toHaveCount(0);

    // Toggling preview off brings the source editor back full-width.
    await page.getByTestId('preview-toggle').click();
    await expect(page.locator('.cm-content')).toBeVisible();
    await expect(page.getByTestId('raw-preview-full')).toHaveCount(0);
  });
});
