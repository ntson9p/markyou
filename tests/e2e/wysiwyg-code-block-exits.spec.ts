import { expect, test, type Page } from '@playwright/test';

/**
 * Getting *out* of a code block (FR-5.1). All live-typing behaviour, which is
 * why seeded-markdown specs never covered it.
 */

const editor = (page: Page) => page.locator('.ProseMirror');
const codeText = (page: Page) => editor(page).locator('.cm-content').first();

async function newWysiwygDoc(page: Page) {
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  // Generous timeout: the WYSIWYG engine is a lazy chunk that the dev server
  // cold-compiles on first navigation under parallel load.
  await expect(editor(page)).toBeVisible({ timeout: 30000 });
  await editor(page).click();
}

/** A document ending in a code block containing `const x = 1;`. */
async function docEndingInCodeBlock(page: Page) {
  await newWysiwygDoc(page);
  await page.keyboard.type('intro para');
  await page.keyboard.press('Enter');
  // The fence rule fires on ```<lang> + whitespace.
  await page.keyboard.type('```js ');
  await expect(codeText(page)).toBeVisible();
  await codeText(page).click();
  await page.keyboard.type('const x = 1;');
  await expect(codeText(page)).toHaveText('const x = 1;');
}

/** Where DOM focus currently sits, as `TAG.className`. */
function activeElement(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName}.${el.className}` : 'NONE';
  });
}

test.describe('Code block keyboard escapes (FR-5.1)', () => {
  test('Tab indents and Shift+Tab outdents without leaving the editor', async ({ page }) => {
    await docEndingInCodeBlock(page);
    await page.keyboard.press('Home');

    await page.keyboard.press('Tab');
    await expect(codeText(page)).toHaveText('  const x = 1;');
    // The caret must stay in the code editor — Tab used to hand focus to the
    // next focusable element and swallow every keystroke after it.
    expect(await activeElement(page)).toContain('cm-content');

    await page.keyboard.press('Shift+Tab');
    await expect(codeText(page)).toHaveText('const x = 1;');
  });

  test('Escape leaves the code block so it is never a keyboard trap', async ({ page }) => {
    await docEndingInCodeBlock(page);
    await page.keyboard.press('Escape');

    expect(await activeElement(page)).toContain('ProseMirror');
    await page.keyboard.type('after escape');
    await expect(editor(page).locator('p').last()).toHaveText('after escape');
    await expect(codeText(page)).toHaveText('const x = 1;');
  });
});
