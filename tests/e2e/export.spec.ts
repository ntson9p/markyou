import { readFile } from 'node:fs/promises';

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
  test('exports a self-contained HTML file (FR-11.1)', async ({ page }) => {
    const dialog = await openExport(page);
    const downloadPromise = page.waitForEvent('download');
    await dialog.getByTestId('export-html').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('doc.html');

    const path = await download.path();
    const html = await readFile(path, 'utf8');
    // Self-contained: inlined typography + KaTeX CSS, rendered content.
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<article class="md-doc">');
    expect(html).toContain('.md-doc {');
    expect(html).toContain('.katex');
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('<h1');
    // No raw markdown tokens leaked into the HTML body.
    expect(html).not.toContain('**world**');
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
