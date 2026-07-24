import { expect, test } from '@playwright/test';

import { getFakeDisk, seedFakeFile, stubFsa } from './helpers';

test.describe('document lifecycle (FR-1)', () => {
  test('new document, typing, dirty indicator', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-new').click();

    const editor = page.getByTestId('editor-textarea');
    await expect(editor).toBeVisible();
    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();

    await editor.fill('# Hello\n\nSome text.');
    await expect(page.getByTestId('dirty-dot')).toBeVisible();
    await expect(page.getByTestId('status-save')).toHaveText('Unsaved changes');
    // Counts run over the raw source in M1 ('#' counts as a token); AST-based counts land in M6.
    await expect(page.getByTestId('status-counts')).toContainText('4 words');
  });

  test('kill tab mid-edit → recovery banner restores every keystroke (FR-1.7)', async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByTestId('welcome-new').click();

    const text = '# Recovered\n\nThis text was never saved to a file.';
    await page.getByTestId('editor-textarea').fill(text);
    // Draft guard writes within 1 s of idle — give it a moment.
    await page.waitForTimeout(1400);

    // Kill the tab without running beforeunload (simulated crash).
    await page.close({ runBeforeUnload: false });

    const reopened = await context.newPage();
    await reopened.goto('/');
    await expect(reopened.getByTestId('recovery-banner')).toBeVisible();

    // Preview shows the draft content as additions.
    await reopened.getByRole('button', { name: 'Preview changes' }).click();
    await expect(reopened.getByLabel('Draft changes preview')).toContainText('# Recovered');

    await reopened.getByTestId('recovery-restore').click();
    await expect(reopened.getByTestId('editor-textarea')).toHaveValue(text);
    await expect(reopened.getByTestId('dirty-dot')).toBeVisible();
  });

  test('discarding a recovery draft leaves a clean welcome screen', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await page.getByTestId('editor-textarea').fill('throwaway');
    await page.waitForTimeout(1400);
    await page.close({ runBeforeUnload: false });

    const reopened = await context.newPage();
    await reopened.goto('/');
    await expect(reopened.getByTestId('recovery-banner')).toBeVisible();
    await reopened.getByTestId('recovery-discard').click();
    await expect(reopened.getByTestId('recovery-banner')).not.toBeVisible();

    await reopened.reload();
    await expect(reopened.getByTestId('welcome-new')).toBeVisible();
    await expect(reopened.getByTestId('recovery-banner')).not.toBeVisible();
  });

  test('save writes the file and clears the dirty state (FR-1.3)', async ({ page }) => {
    await stubFsa(page);
    await page.goto('/');
    await page.getByTestId('welcome-new').click();

    await page.getByTestId('editor-textarea').fill('# My Notes\n\ncontent here');
    await page.keyboard.press('ControlOrMeta+s');

    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    await expect(page.getByTestId('doc-title')).toHaveText('my-notes.md');

    const disk = await getFakeDisk(page);
    expect(disk['my-notes.md']).toBe('# My Notes\n\ncontent here');
  });

  test('a clean save leaves no recovery draft behind', async ({ context }) => {
    const page = await context.newPage();
    await stubFsa(page);
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await page.getByTestId('editor-textarea').fill('saved content');
    await page.waitForTimeout(1400);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    await page.close({ runBeforeUnload: false });

    const reopened = await context.newPage();
    await reopened.goto('/');
    await expect(reopened.getByTestId('welcome-new')).toBeVisible();
    await expect(reopened.getByTestId('recovery-banner')).not.toBeVisible();
  });

  test('open an existing file via the picker (FR-1.2)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'readme.md', '# Existing\n\nfile content');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();

    await expect(page.getByTestId('editor-textarea')).toHaveValue('# Existing\n\nfile content');
    await expect(page.getByTestId('doc-title')).toHaveText('readme.md');
    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();
  });

  test('recents appear on the welcome screen after opening a file (FR-1.5)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'notes.md', 'notes');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.getByTestId('editor-textarea')).toHaveValue('notes');

    await page.reload();
    await expect(page.getByTestId('recents-list')).toContainText('notes.md');
  });

  test('save-as suggests a filename derived from the first heading (FR-1.4)', async ({ page }) => {
    await stubFsa(page);
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await page.getByTestId('editor-textarea').fill('## Meeting Minutes 2026\n\n- item');
    await page.keyboard.press('ControlOrMeta+Shift+s');

    await expect(page.getByTestId('doc-title')).toHaveText('meeting-minutes-2026.md');
    const disk = await getFakeDisk(page);
    expect(disk['meeting-minutes-2026.md']).toContain('## Meeting Minutes 2026');
  });

  test('mode switcher persists the last-used mode (FR-2.3)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await page.getByRole('radio', { name: 'Raw' }).click();
    await page.reload();
    await page.getByTestId('welcome-new').click();
    await expect(page.getByRole('radio', { name: 'Raw' })).toHaveAttribute('data-state', 'on');
  });
});
