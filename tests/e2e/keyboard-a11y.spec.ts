import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

async function openWysiwyg(page: Page, content: string) {
  await stubFsa(page);
  await seedFakeFile(page, 'doc.md', content);
  await pinMode(page, 'wysiwyg');
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
}

test.describe('keyboard operability (§a11y, WCAG 2.1.1)', () => {
  test('WYSIWYG toolbar is a single tab stop with arrow-key roving', async ({ page }) => {
    await openWysiwyg(page, '# Doc\n\ntext\n');
    const toolbar = page.getByTestId('wysiwyg-toolbar');
    await expect(toolbar).toBeVisible();

    // Exactly one control is in the Tab order; the rest are roving (-1).
    await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
    expect(await toolbar.locator('button[tabindex="-1"]').count()).toBeGreaterThan(1);

    const first = toolbar.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    const redo = toolbar.getByRole('button', { name: 'Redo (Ctrl+Y)' });
    await first.focus();
    await expect(first).toHaveAttribute('tabindex', '0');

    // Arrow keys move focus and the roving tabindex along with it.
    await page.keyboard.press('ArrowRight');
    await expect(redo).toBeFocused();
    await expect(redo).toHaveAttribute('tabindex', '0');
    await expect(first).toHaveAttribute('tabindex', '-1');

    // Home / End jump to the ends of the toolbar.
    await page.keyboard.press('End');
    await expect(toolbar.locator('button').last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
  });

  test('Escape closes the metadata dialog and returns focus to the document', async ({ page }) => {
    await openWysiwyg(page, '---\ntitle: T\n---\n\n# Doc\n');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Metadata…' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('Ctrl+/ opens the searchable keyboard-shortcuts sheet (§8.3)', async ({ page }) => {
    await openWysiwyg(page, '# Doc\n');

    await page.keyboard.press('ControlOrMeta+/');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Find / Replace')).toBeVisible();

    // The filter narrows the visible shortcuts.
    await page.getByTestId('shortcuts-filter').fill('bold');
    await expect(dialog.getByText('Bold / Italic / Strikethrough')).toBeVisible();
    await expect(dialog.getByText('Find / Replace')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
