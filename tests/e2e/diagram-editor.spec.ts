import { expect, test, type Page } from '@playwright/test';

import { getFakeDisk, seedFakeFile, stubFsa } from './helpers';

/**
 * Full-screen mermaid editor (FR-5.9): source ⇄ live preview, edits committed
 * only on Apply, and every close path guarded by one in-app confirmation.
 */

const DOC = '# Diagrams\n\n```mermaid\ngraph TD;\n  A-->B;\n```\n\nAfter.\n';

async function openDoc(page: Page) {
  await stubFsa(page);
  await seedFakeFile(page, 'diagram.md', DOC);
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
  const diagram = page.locator('.diagram-node');
  // Mermaid is a lazy chunk; the in-document SVG appears once it loads.
  await expect(diagram.locator('svg')).toBeVisible({ timeout: 30000 });
  return diagram;
}

const modal = (page: Page) => page.getByRole('dialog', { name: 'Edit Mermaid diagram' });
const source = (page: Page) => page.getByTestId('diagram-source');
const preview = (page: Page) => page.getByTestId('diagram-preview');

test.describe('mermaid editor modal (FR-5.9)', () => {
  test('opens with source and preview side by side', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();

    await expect(modal(page)).toBeVisible();
    await expect(source(page)).toHaveValue(/graph TD/);
    await expect(preview(page).locator('svg')).toBeVisible({ timeout: 20000 });

    // Two panes with a draggable, keyboard-operable divider between them.
    const divider = modal(page).getByRole('separator', { name: 'Resize source and preview' });
    await expect(divider).toBeVisible();
    // Source is the narrower column by default (1/3 · 2/3).
    const sourceBox = (await source(page).boundingBox())!;
    const previewBox = (await preview(page).boundingBox())!;
    expect(sourceBox.width).toBeLessThan(previewBox.width);
  });

  test('the preview follows the source without touching the document', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await expect(preview(page).locator('svg')).toBeVisible({ timeout: 20000 });

    await source(page).fill('graph TD;\n  Alpha-->Beta;\n  Beta-->Gamma;');
    // Debounced live render (no Apply yet).
    await expect(preview(page).locator('svg')).toContainText('Gamma', { timeout: 20000 });

    // The document still shows the original diagram.
    await expect(diagram.locator('svg')).not.toContainText('Gamma');
  });

  test('invalid syntax reports an error and keeps the last good diagram', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await expect(preview(page).locator('svg')).toBeVisible({ timeout: 20000 });

    await source(page).fill('graph TD;\n  A--&&-->;;B');
    await expect(page.getByTestId('diagram-error')).toBeVisible({ timeout: 20000 });
    // The pane keeps the previous render instead of blanking mid-edit.
    await expect(preview(page).locator('svg')).toBeVisible();
  });

  test('Apply commits the change to the document and the file', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await source(page).fill('graph TD;\n  Alpha-->Beta;');
    await page.getByTestId('diagram-apply').click();

    await expect(modal(page)).toBeHidden();
    await expect(diagram.locator('svg')).toContainText('Alpha', { timeout: 20000 });

    await page.waitForTimeout(600); // push debounce
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    const saved = (await getFakeDisk(page))['diagram.md'];
    expect(saved).toContain('Alpha-->Beta;');
    expect(saved).toContain('```mermaid');
  });

  test('the source keeps focus through the first keystroke', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await source(page).click();
    await expect(source(page)).toBeFocused();

    // The first edit flips the modal from clean to dirty; nothing about that
    // may move focus out of the field being typed into.
    await page.keyboard.type('A');
    await expect(source(page)).toBeFocused();

    // …and every following keystroke still lands in the source.
    await page.keyboard.type('BC');
    await expect(source(page)).toHaveValue(/ABC/);
    await expect(source(page)).toBeFocused();
  });

  test('opening focuses the source, ready to type', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await expect(source(page)).toBeFocused();
  });

  test('closing without edits needs no confirmation', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await page.getByTestId('diagram-cancel').click();
    await expect(page.getByTestId('diagram-confirm')).toBeHidden();
    await expect(modal(page)).toBeHidden();
  });

  test('unsaved edits are guarded on Cancel, backdrop and Escape', async ({ page }) => {
    const diagram = await openDoc(page);

    for (const dismiss of ['cancel', 'backdrop', 'escape'] as const) {
      await diagram.click();
      await expect(modal(page)).toBeVisible();
      await source(page).fill('graph TD;\n  Draft-->Only;');

      if (dismiss === 'cancel') await page.getByTestId('diagram-cancel').click();
      else if (dismiss === 'escape') await page.keyboard.press('Escape');
      else await page.mouse.click(5, 5); // outside the panel

      // Every path lands on the same in-app confirmation (not window.confirm).
      const confirm = page.getByTestId('diagram-confirm');
      await expect(confirm).toBeVisible();
      await expect(modal(page)).toBeVisible();

      // Keep editing returns to the draft, intact.
      await confirm.getByRole('button', { name: 'Keep editing' }).click();
      await expect(confirm).toBeHidden();
      await expect(source(page)).toHaveValue(/Draft-->Only/);

      // Discard closes and leaves the document untouched.
      await page.keyboard.press('Escape');
      await expect(confirm).toBeVisible();
      await confirm.getByRole('button', { name: 'Discard changes' }).click();
      await expect(modal(page)).toBeHidden();
      await expect(diagram.locator('svg')).not.toContainText('Draft');
    }

    // The fence survives the whole session byte-identical (D13).
    await page.keyboard.press('ControlOrMeta+Shift+Digit1');
    await expect(page.locator('.cm-content')).toContainText('graph TD;');
  });

  test('Escape while confirming returns to editing, not out of the modal', async ({ page }) => {
    const diagram = await openDoc(page);
    await diagram.click();
    await source(page).fill('graph TD;\n  X-->Y;');
    await page.keyboard.press('Escape');

    const confirm = page.getByTestId('diagram-confirm');
    await expect(confirm).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(modal(page)).toBeVisible();
  });
});
