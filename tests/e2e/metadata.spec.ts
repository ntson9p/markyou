import { expect, test } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

async function openMetadata(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: /Metadata/ }).click();
  return page.getByRole('dialog', { name: 'Document metadata' });
}

test.describe('metadata panel (FR-10.4)', () => {
  test('adding a field writes a frontmatter block to the source', async ({ page }) => {
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await expect(page.locator('.cm-content')).toBeVisible();

    const dialog = await openMetadata(page);
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('metadata-add').click();
    await dialog.getByPlaceholder('key').fill('title');
    await dialog.getByPlaceholder('value').fill('My Title');
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The frontmatter now appears at the top of the raw source.
    await expect(page.locator('.cm-content')).toContainText('title: My Title');
  });

  test('invalid YAML falls back to a raw editing field with a notice', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'bad.md', '---\ntitle: [unclosed\n---\n\nbody\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.cm-content')).toBeVisible();

    const dialog = await openMetadata(page);
    await expect(dialog.getByTestId('metadata-yaml-error')).toBeVisible();
    await expect(dialog.getByTestId('metadata-raw')).toHaveValue(/title: \[unclosed/);
    // No fields grid while the YAML can't be parsed.
    await expect(dialog.getByTestId('metadata-fields')).toHaveCount(0);
  });

  test('existing scalar frontmatter loads as editable fields', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'meta.md', '---\ntitle: Existing\nauthor: Sam\n---\n\nbody\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.cm-content')).toBeVisible();

    const dialog = await openMetadata(page);
    await expect(dialog.getByTestId('metadata-fields')).toBeVisible();
    await expect(dialog.getByLabel('Value for title')).toHaveValue('Existing');
    await expect(dialog.getByLabel('Value for author')).toHaveValue('Sam');

    // Removing a field updates the source.
    await dialog.getByRole('button', { name: 'Remove author' }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.cm-content')).not.toContainText('author: Sam');
    await expect(page.locator('.cm-content')).toContainText('title: Existing');
  });
});
