import { expect, test } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

test.describe('version history (FR-12)', () => {
  test('a save creates a version; restoring reverts the document', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Original\n\nfirst content\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    const cm = page.locator('.cm-content');
    await expect(cm).toBeVisible();

    // Edit + save → a 'Saved' snapshot of the saved text (FR-12.1).
    await cm.click();
    await cm.fill('# Original\n\nfirst content EDITED\n');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');

    // Diverge with an unsaved change.
    await cm.fill('# Original\n\ntotally different now\n');

    // History lists the saved version and shows a diff against the current text.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: /History/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Version history' });
    const items = dialog.locator('[data-testid="history-list"] button');
    await expect(items.first()).toBeVisible();
    await expect(items.first()).toContainText('Saved');
    await expect(dialog.getByTestId('history-diff')).toBeVisible();

    // Restore → document reverts to the saved snapshot and is dirty again.
    await dialog.getByTestId('history-restore').click();
    await expect(cm).toContainText('first content EDITED');
    await expect(cm).not.toContainText('totally different now');
    await expect(page.getByTestId('dirty-dot')).toBeVisible();

    // The pre-restore state was itself snapshotted (FR-12.3): reopening history
    // now shows a Restore point in addition to the save.
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: /History/ }).click();
    await expect(dialog.getByText('Restore point')).toBeVisible();
  });
});
