import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

const DOC = '# Export Me\n\nHello **world** with `code` and a [link](https://example.com).\n';

async function openExport(page: Page) {
  await stubFsa(page);
  await seedFakeFile(page, 'doc.md', DOC);
  await pinMode(page, 'raw');
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('menuitem', { name: /Export/ }).click();
  return page.getByRole('dialog', { name: 'Export' });
}

test.describe('export (FR-11)', () => {
  test('downloads an HTML file named from the document (FR-11.1)', async ({ page }) => {
    // Content is asserted in the html-standalone unit test; here we verify the
    // download wiring + filename derivation.
    const dialog = await openExport(page);
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByTestId('export-html').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('doc.html');
    await expect(dialog.getByTestId('export-status')).toContainText('doc.html');
  });

  test('copies rich text to the clipboard (FR-11.3)', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'Clipboard read/permissions are Chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const dialog = await openExport(page);
    await dialog.getByTestId('export-copy').click();
    await expect(dialog.getByTestId('export-status')).toContainText('Copied rich text');

    const html = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          return (await (await item.getType('text/html')).text()) as string;
        }
      }
      return '';
    });
    expect(html).toContain('<strong>world</strong>');
  });

  test('print-to-PDF opens the print flow (FR-11.2)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'window.print automation is Chromium-only');
    const dialog = await openExport(page);
    await dialog.getByTestId('export-pdf').click();
    await expect(dialog.getByTestId('export-status')).toContainText('print dialog');
  });
});
