import { expect, test, type Page } from '@playwright/test';

/**
 * The `$$` autoformat (FR-5.8). Seeded-markdown specs never covered this: the
 * parse path always worked, while the live-typing input rule threw on every
 * keystroke and left `$$` sitting there as plain text.
 */

const editor = (page: Page) => page.locator('.ProseMirror');

async function newWysiwygDoc(page: Page) {
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  // Generous timeout: the WYSIWYG engine is a lazy chunk that the dev server
  // cold-compiles on first navigation under parallel load.
  await expect(editor(page)).toBeVisible({ timeout: 30000 });
  await editor(page).click();
}

test.describe('Block math autoformat (FR-5.8)', () => {
  test('typing `$$ ` creates a math block and opens its LaTeX editor', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('$$ ');

    await expect(editor(page).locator('[data-type="math-block"]')).toHaveCount(1);
    const popover = page.locator('.source-popover');
    await expect(popover).toBeVisible();

    await page.keyboard.type('\\int_0^1 x\\,dx');
    await popover.getByRole('button', { name: 'Apply' }).click();
    await expect(editor(page).locator('[data-type="math-block"] .katex')).toHaveCount(1);
  });

  test('`$$ ` mid-paragraph is left alone rather than eating the line', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('keep me');
    await page.keyboard.press('Home');
    await page.keyboard.type('$$ ');

    await expect(editor(page).locator('[data-type="math-block"]')).toHaveCount(0);
    await expect(editor(page).locator('p').first()).toHaveText('$$ keep me');
  });
});
