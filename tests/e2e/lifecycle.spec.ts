import { expect, test, type Page } from '@playwright/test';

import { getFakeDisk, pinMode, seedFakeFile, stubFsa } from './helpers';

/** Raw-mode source editor (CodeMirror). File flows are editor-agnostic; raw is
 *  the simplest real editor to drive — it edits the full text like the file. */
const source = (page: Page) => page.locator('.cm-content');

async function setSource(page: Page, text: string) {
  const el = source(page);
  await el.click();
  await el.fill(text);
}

test.describe('document lifecycle (FR-1)', () => {
  test.beforeEach(async ({ page }) => {
    await pinMode(page, 'raw');
  });

  test('new document, typing, dirty indicator', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-new').click();

    await expect(source(page)).toBeVisible();
    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();

    await setSource(page, '# Hello\n\nSome text.');
    await expect(page.getByTestId('dirty-dot')).toBeVisible();
    await expect(page.getByTestId('status-save')).toHaveText('Unsaved changes');
    // Counts run over the raw source ('#' counts as a token); AST counts land in M6.
    await expect(page.getByTestId('status-counts')).toContainText('4 words');
  });

  test('kill tab mid-edit → recovery banner restores every keystroke (FR-1.7)', async ({
    context,
  }) => {
    const page = await context.newPage();
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-new').click();

    const text = '# Recovered\n\nThis text was never saved to a file.';
    await setSource(page, text);
    // Draft guard writes within 1 s of idle — give it a moment.
    await page.waitForTimeout(1400);

    // Kill the tab without running beforeunload (simulated crash).
    await page.close({ runBeforeUnload: false });

    const reopened = await context.newPage();
    await pinMode(reopened, 'raw');
    await reopened.goto('/');
    await expect(reopened.getByTestId('recovery-banner')).toBeVisible();

    // Preview shows the draft content as additions.
    await reopened.getByRole('button', { name: 'Preview changes' }).click();
    await expect(reopened.getByLabel('Draft changes preview')).toContainText('# Recovered');

    await reopened.getByTestId('recovery-restore').click();
    await expect(source(reopened)).toContainText('# Recovered');
    await expect(source(reopened)).toContainText('This text was never saved to a file.');
    await expect(reopened.getByTestId('dirty-dot')).toBeVisible();
  });

  test('discarding a recovery draft leaves a clean welcome screen', async ({ context }) => {
    const page = await context.newPage();
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await setSource(page, 'throwaway');
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

    await setSource(page, '# My Notes\n\ncontent here');
    await page.keyboard.press('ControlOrMeta+s');

    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    await expect(page.getByTestId('doc-title')).toHaveText('my-notes.md');

    const disk = await getFakeDisk(page);
    expect(disk['my-notes.md']).toBe('# My Notes\n\ncontent here');
  });

  test('a clean save leaves no recovery draft behind', async ({ context }) => {
    const page = await context.newPage();
    await pinMode(page, 'raw');
    await stubFsa(page);
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await setSource(page, 'saved content');
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

    await expect(source(page)).toContainText('# Existing');
    await expect(source(page)).toContainText('file content');
    await expect(page.getByTestId('doc-title')).toHaveText('readme.md');
    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();
  });

  test('recents appear on the welcome screen after opening a file (FR-1.5)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'notes.md', 'notes');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(source(page)).toContainText('notes');

    await page.reload();
    await expect(page.getByTestId('recents-list')).toContainText('notes.md');
  });

  test('save-as suggests a filename derived from the first heading (FR-1.4)', async ({ page }) => {
    await stubFsa(page);
    await page.goto('/');
    await page.getByTestId('welcome-new').click();
    await setSource(page, '## Meeting Minutes 2026\n\n- item');
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
