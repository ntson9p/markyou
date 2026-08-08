import { expect, test } from '@playwright/test';

import { getFakeDisk, pinMode, seedFakeFile, stubFsa } from './helpers';

test.describe('review changes diff (unsaved vs. last saved)', () => {
  test('status chip opens the diff; chunk revert, unified toggle, save inside', async ({
    page,
  }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Title\n\nalpha\nbeta\ngamma\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    const cm = page.locator('.cm-content');
    await expect(cm).toBeVisible();

    // Two separated edits → two change blocks.
    await cm.click();
    await cm.fill('# Title CHANGED\n\nalpha\nbeta\ngamma\nnew line\n');

    // The save-state text becomes a chip with live stats.
    const chip = page.getByTestId('status-save');
    await expect(chip).toContainText('Unsaved changes');
    await expect(page.getByTestId('status-diff-stats')).toBeVisible();
    await chip.click();

    const overlay = page.getByTestId('diff-overlay');
    // Generous timeout: the overlay is a lazy chunk and this can be its cold load.
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    // Split view by default: the merge view aligns saved (left) and current (right).
    await expect(overlay.locator('.cm-mergeView')).toBeVisible();
    await expect(overlay.getByTestId('diff-chunk-pos')).toContainText('/ 2');

    // Per-chunk revert from the gutter restores the saved heading.
    await overlay.locator('.diff-revert-btn').first().click();
    await expect(overlay.getByTestId('diff-chunk-pos')).toContainText('/ 1');

    // Unified layout replaces the two panes with one annotated editor.
    await overlay.getByTestId('diff-layout-unified').click();
    await expect(overlay.locator('.cm-mergeView')).toHaveCount(0);
    await expect(overlay.locator('.cm-changedLine').first()).toBeVisible();

    // Save from inside the overlay → converges to the saved empty state.
    await overlay.getByTestId('diff-save').click();
    await expect(overlay.getByTestId('diff-empty')).toContainText('All changes saved');
    const disk = await getFakeDisk(page);
    expect(disk['doc.md']).toBe('# Title\n\nalpha\nbeta\ngamma\nnew line\n');

    // Esc closes the overlay.
    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });

  test('Ctrl+Shift+D opens it; edits are live; revert all restores the saved text', async ({
    page,
  }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Doc\n\none\ntwo\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    const cm = page.locator('.cm-content');
    await expect(cm).toBeVisible();

    await cm.click();
    await cm.fill('# Doc\n\none EDITED\ntwo\n');

    await page.keyboard.press('ControlOrMeta+Shift+d');
    const overlay = page.getByTestId('diff-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });

    // The right pane is the live document: type into it directly.
    const editable = overlay.locator('.cm-content').last();
    await editable.click();
    await page.keyboard.type('X');

    // Revert all (one undoable transaction) restores the saved text everywhere.
    await overlay.getByTestId('diff-revert-all').click();
    await expect(overlay.getByTestId('diff-chunk-pos')).toContainText('No changes');

    await overlay.getByTestId('diff-close').click();
    await expect(overlay).not.toBeVisible();
    await expect(cm).toContainText('one');
    await expect(cm).not.toContainText('EDITED');
    await expect(cm).not.toContainText('X');
  });
});
