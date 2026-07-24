import { expect, test } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

const DOC = [
  '# Title',
  '',
  'intro paragraph',
  '',
  '## Section One',
  '',
  'content one',
  '',
  '## Section Two',
  '',
  'content two',
  '',
  '### Sub Section',
  '',
  'deep content',
].join('\n');

test.describe('outline & counts (FR-10)', () => {
  test('outline toggles, lists the heading tree, and jumps (FR-10.1)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', DOC);
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(page.locator('.cm-content')).toBeVisible();

    // Hidden by default; the toolbar button reveals it.
    await expect(page.getByTestId('outline')).toHaveCount(0);
    await page.getByTestId('outline-toggle').click();
    const outline = page.getByTestId('outline');
    await expect(outline).toBeVisible();
    await expect(outline.getByRole('button', { name: 'Title' })).toBeVisible();
    await expect(outline.getByRole('button', { name: 'Section One' })).toBeVisible();
    await expect(outline.getByRole('button', { name: 'Sub Section' })).toBeVisible();

    // Clicking a heading jumps the source cursor to its line (## Section Two = L9).
    await outline.getByRole('button', { name: 'Section Two' }).click();
    await expect(page.getByTestId('status-cursor')).toContainText('L9');

    // Ctrl+Shift+O hides it again.
    await page.keyboard.press('ControlOrMeta+Shift+KeyO');
    await expect(page.getByTestId('outline')).toHaveCount(0);
  });

  test('selection-scoped counts show while text is selected (FR-10.2)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Title\n\nalpha beta gamma delta\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    const cm = page.locator('.cm-content');
    await expect(cm).toBeVisible();
    await expect(page.getByTestId('status-counts')).toContainText('min read');

    await cm.click();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(page.getByTestId('status-selection-counts')).toContainText('words selected');

    // Collapsing the selection restores the document-wide counts.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('status-selection-counts')).toHaveCount(0);
    await expect(page.getByTestId('status-counts')).toContainText('min read');
  });
});
