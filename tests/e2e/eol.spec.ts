import { expect, test } from '@playwright/test';

import { getFakeDisk, pinMode, seedFakeFile, stubFsa } from './helpers';

/**
 * EOL policy: the store is LF-canonical, but a CRLF file must (1) not make the
 * Review Changes diff report every line as changed, and (2) keep its CRLF
 * endings when written back to disk.
 */
test.describe('CRLF documents', () => {
  test('diff shows only the real change; saving preserves CRLF', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'crlf.md', '# T\r\n\r\nalpha\r\nbeta\r\ngamma\r\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    const cm = page.locator('.cm-content');
    await expect(cm).toBeVisible();

    await cm.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('tail-edit');

    // The chip counts the real change, not a phantom every-line rewrite.
    const stats = page.getByTestId('status-diff-stats');
    await expect(stats).toContainText('+1');
    await expect(stats).toContainText('−1');

    await page.keyboard.press('ControlOrMeta+Shift+d');
    const overlay = page.getByTestId('diff-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(overlay.getByTestId('diff-chunk-pos')).toContainText('/ 1');

    // Save from the diff → the disk file keeps its CRLF flavor.
    await overlay.getByTestId('diff-save').click();
    await expect(overlay.getByTestId('diff-empty')).toContainText('All changes saved');
    const disk = await getFakeDisk(page);
    expect(disk['crlf.md']).toBe('# T\r\n\r\nalpha\r\nbeta\r\ngamma\r\ntail-edit');
  });
});
