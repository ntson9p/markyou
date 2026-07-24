import { expect, test, type Page } from '@playwright/test';

import { getFakeDisk, pinMode, seedFakeFile, stubFsa } from './helpers';

/** Dual mode & sync (FR-6, plan §2). Raw (CodeMirror) left, WYSIWYG (Milkdown)
 *  right, both editing one store through the origin/version/equality guards. */

const raw = (page: Page) => page.locator('.cm-content');
const wys = (page: Page) => page.locator('.ProseMirror');

async function openDual(page: Page, name: string, content: string) {
  await stubFsa(page);
  await seedFakeFile(page, name, content);
  await pinMode(page, 'dual');
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(raw(page)).toBeVisible({ timeout: 30000 });
  await expect(wys(page)).toBeVisible({ timeout: 30000 });
}

test.describe('dual mode & sync (FR-6)', () => {
  test('both panes render side by side with the shared toolbar', async ({ page }) => {
    await openDual(page, 'dual.md', '# Dual\n\nintro paragraph\n');
    await expect(wys(page).locator('h1')).toHaveText('Dual');
    await expect(raw(page)).toContainText('# Dual');
    await expect(page.getByTestId('wysiwyg-toolbar')).toBeVisible();
    await expect(page.getByTestId('split-divider')).toBeVisible();
  });

  test('raw edits propagate to the WYSIWYG pane (FR-6.1)', async ({ page }) => {
    await openDual(page, 'dual.md', '# Dual\n\nintro\n');
    await raw(page).click();
    await raw(page).fill('# Retitled\n\nfrom the source pane\n');
    await expect(wys(page).locator('h1')).toHaveText('Retitled');
    await expect(wys(page)).toContainText('from the source pane');
  });

  test('raw edits never reformat untouched text (FR-6.2, FR-3.4)', async ({ page }) => {
    await openDual(page, 'dual.md', '- initial\n');
    // Author non-canonical markdown (a `+` bullet) directly in the source pane.
    await raw(page).click();
    await raw(page).fill('+ plus-marker kept\n\nplain paragraph\n');

    // The WYSIWYG pane reflects the source edit.
    await expect(wys(page).locator('li')).toContainText('plus-marker kept');
    await expect(wys(page)).toContainText('plain paragraph');

    // The store→WYSIWYG replace is muted (addToHistory:false), so it never
    // echoes a re-serialized (normalized) body back: the `+` marker the user
    // typed survives byte-faithfully — raw-mode edits never reformat (D13).
    await page.waitForTimeout(700);
    await expect(raw(page)).toContainText('+ plus-marker kept');
    await expect(raw(page)).not.toContainText('- plus-marker kept');
  });

  test('a WYSIWYG edit re-serializes the body with the style prefs (FR-6.2)', async ({ page }) => {
    // The complement of the above: editing in WYSIWYG DOES normalize (D13).
    await openDual(page, 'dual.md', '+ plus-marker\n\nbody\n');
    await wys(page).locator('p', { hasText: 'body' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' edited');
    // The whole body re-serializes with the canonical `-` bullet marker.
    await expect(raw(page)).toContainText('- plus-marker');
    await expect(raw(page)).toContainText('body edited');
  });

  test('alternating typing stays convergent with no loop (FR-6, M5 exit)', async ({ page }) => {
    await openDual(page, 'dual.md', '# Shared\n\nbody\n');

    // 1) WYSIWYG → raw
    await wys(page).locator('p', { hasText: 'body' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' wys1');
    await expect(raw(page)).toContainText('body wys1');

    // 2) raw → WYSIWYG (append a block at the end of the source)
    await raw(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n\nraw2 line');
    await expect(wys(page)).toContainText('raw2 line');

    // 3) WYSIWYG → raw again
    await wys(page).locator('p', { hasText: 'raw2 line' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' wys3');
    await expect(raw(page)).toContainText('raw2 line wys3');

    // Settle, then save. A sync loop would keep bumping the version → re-dirty.
    await page.waitForTimeout(700);
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    await page.waitForTimeout(900);
    await expect(page.getByTestId('dirty-dot')).not.toBeVisible();
    await expect(page.getByTestId('status-save')).toContainText('Saved');

    // No divergence: the store (= disk on save) holds every contribution.
    const disk = await getFakeDisk(page);
    expect(disk['dual.md']).toContain('# Shared');
    expect(disk['dual.md']).toContain('body wys1');
    expect(disk['dual.md']).toContain('raw2 line wys3');
  });

  test('continuous WYSIWYG typing is not corrupted by cross-pane sync (FR-6.1)', async ({
    page,
  }) => {
    await openDual(page, 'dual.md', '# Doc\n\nstart\n');
    await wys(page).locator('p', { hasText: 'start' }).click();
    await page.keyboard.press('End');
    // Type a long run while the raw pane keeps re-syncing underneath.
    const run = ' the quick brown fox jumps over the lazy dog again and again';
    await page.keyboard.type(run);
    await expect(wys(page)).toContainText('start' + run);
    await expect(raw(page)).toContainText('start' + run);
  });

  test('pathological input keeps the source pane editable and uncorrupted (FR-6.4)', async ({
    page,
  }) => {
    // Deeply nested / unusual input the rich editor may struggle to model.
    const weird = '> '.repeat(40) + 'deep\n\n' + '```\nunclosed fence\n';
    await openDual(page, 'weird.md', weird);
    // Whatever the WYSIWYG pane does, the source pane stays editable and the
    // store is never corrupted (FR-6.4): we can keep typing in raw.
    await raw(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('\n\nstill editable');
    await expect(raw(page)).toContainText('still editable');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    const disk = await getFakeDisk(page);
    expect(disk['weird.md']).toContain('still editable');
  });
});
