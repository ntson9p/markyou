import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

async function openWysiwyg(page: Page, content: string) {
  await stubFsa(page);
  await seedFakeFile(page, 'doc.md', content);
  await pinMode(page, 'wysiwyg');
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
  await page.locator('.ProseMirror').click();
}

test.describe('find & replace (FR-9)', () => {
  test('WYSIWYG find highlights, counts, and cycles matches (FR-9.1)', async ({ page }) => {
    await openWysiwyg(page, '# Find\n\nalpha beta alpha gamma alpha\n');

    await page.keyboard.press('ControlOrMeta+f');
    const bar = page.getByTestId('wysiwyg-find-bar');
    await expect(bar).toBeVisible();

    await bar.getByTestId('wysiwyg-find-input').fill('alpha');
    await expect(bar.getByTestId('wysiwyg-find-count')).toHaveText('1 of 3');
    await expect(page.locator('.ProseMirror .pm-find-match')).toHaveCount(3);
    await expect(page.locator('.ProseMirror .pm-find-active')).toHaveCount(1);

    await bar.getByTestId('wysiwyg-find-input').press('Enter');
    await expect(bar.getByTestId('wysiwyg-find-count')).toHaveText('2 of 3');
    await bar.getByTestId('wysiwyg-find-input').press('Shift+Enter');
    await expect(bar.getByTestId('wysiwyg-find-count')).toHaveText('1 of 3');

    await bar.getByTestId('wysiwyg-find-input').press('Escape');
    await expect(bar).toHaveCount(0);
    await expect(page.locator('.ProseMirror .pm-find-match')).toHaveCount(0);
  });

  test('WYSIWYG replace-all rewrites every match (FR-9.2)', async ({ page }) => {
    await openWysiwyg(page, '# R\n\nfoo bar foo baz foo\n');

    await page.keyboard.press('ControlOrMeta+h');
    const bar = page.getByTestId('wysiwyg-find-bar');
    await expect(bar).toBeVisible();
    await bar.getByTestId('wysiwyg-find-input').fill('foo');
    await expect(bar.getByTestId('wysiwyg-find-count')).toHaveText('1 of 3');
    await bar.getByTestId('wysiwyg-replace-input').fill('X');
    await bar.getByTestId('wysiwyg-replace-all').click();

    await expect(page.locator('.ProseMirror')).toContainText('X bar X baz X');
    await expect(page.locator('.ProseMirror')).not.toContainText('foo');
  });

  test('raw mode Ctrl+F opens the CodeMirror search panel (FR-9.3)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Doc\n\nfind this text\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await page.locator('.cm-content').click();

    await page.keyboard.press('ControlOrMeta+f');
    // CodeMirror's search panel provides regex/case/whole-word toggles (FR-9.3).
    await expect(page.locator('.cm-search')).toBeVisible();
  });
});
