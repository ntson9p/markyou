import { expect, test, type Page } from '@playwright/test';

async function openRawWithDoc(page: Page, text?: string) {
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  await page.keyboard.press('ControlOrMeta+Shift+Digit1'); // raw mode
  await expect(page.getByTestId('raw-editor')).toBeVisible();
  if (text) {
    await page.locator('.cm-content').click();
    // Fill via CM APIs is unavailable; type through the keyboard.
    await page.keyboard.insertText(text);
  }
}

test.describe('raw mode + preview (FR-3, FR-4)', () => {
  test('typing markdown renders in the live preview', async ({ page }) => {
    await openRawWithDoc(page, '# Big Title\n\nSome **bold** text.');

    const preview = page.getByTestId('preview');
    await expect(preview.locator('h1')).toHaveText('Big Title');
    await expect(preview.locator('strong')).toHaveText('bold');
  });

  test('markdown syntax highlighting is active', async ({ page }) => {
    await openRawWithDoc(page, '# Heading');
    // The heading should get a styled span (non-default color/weight).
    const headingSpan = page.locator('.cm-line span').first();
    await expect(headingSpan).toBeVisible();
  });

  test('preview toggles via Ctrl+Shift+P and the toolbar button (FR-3.3)', async ({ page }) => {
    await openRawWithDoc(page);
    await expect(page.getByTestId('preview')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+Shift+p');
    await expect(page.getByTestId('preview')).not.toBeVisible();

    await page.getByTestId('preview-toggle').click();
    await expect(page.getByTestId('preview')).toBeVisible();
  });

  test('Ctrl+B wraps the selection in ** (FR-3.5)', async ({ page }) => {
    await openRawWithDoc(page, 'make this bold');
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(page.locator('.cm-content')).toContainText('**make this bold**');
  });

  test('list continuation on Enter (FR-3.2)', async ({ page }) => {
    await openRawWithDoc(page, '- first item');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('second');
    await expect(page.locator('.cm-content')).toContainText('- second');
  });

  test('flavor extensions render in preview (§6)', async ({ page }) => {
    await openRawWithDoc(
      page,
      [
        '| a | b |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '- [x] done',
        '',
        '~~strike~~',
        '',
        '> [!NOTE]',
        '> called out',
        '',
        '$x^2$',
      ].join('\n'),
    );

    const preview = page.getByTestId('preview');
    await expect(preview.locator('table')).toBeVisible();
    await expect(preview.locator('input[type="checkbox"]')).toBeChecked();
    await expect(preview.locator('del')).toHaveText('strike');
    await expect(preview.locator('.callout-note')).toContainText('called out');
    await expect(preview.locator('.katex').first()).toBeVisible();
  });

  test('frontmatter is highlighted in raw but hidden from preview (FR-5.12)', async ({ page }) => {
    await openRawWithDoc(page, '---\ntitle: Hidden\n---\n\n# Shown');
    const preview = page.getByTestId('preview');
    await expect(preview.locator('h1')).toHaveText('Shown');
    await expect(preview).not.toContainText('Hidden');
  });

  test('scroll sync: scrolling raw moves the preview (FR-4.3)', async ({ page }) => {
    const lines = Array.from({ length: 120 }, (_, i) => `## Section ${i}\n\ntext for ${i}.`).join(
      '\n\n',
    );
    await openRawWithDoc(page, lines);

    const preview = page.getByTestId('preview');
    const previewTop = () => preview.evaluate((el) => el.scrollTop);
    const scrollRawTo = (fraction: number) =>
      page.locator('.cm-scroller').evaluate((el, f) => {
        el.scrollTop = f * el.scrollHeight;
      }, fraction);

    // Sync interpolates between `data-sourcepos` anchors, so it does nothing at
    // all until the preview has rendered them. Wait on the content itself
    // rather than on a delay long enough to usually cover it.
    await expect(preview.locator('h2')).toHaveCount(120, { timeout: 15_000 });

    // Typing leaves the caret at the end, so both panes may already be at the
    // bottom. Drive the baseline to the top instead of assuming it: sampling it
    // blind records whatever the render race happened to leave behind, and a
    // baseline at the bottom turns the assertion below into a backwards test.
    await scrollRawTo(0);
    await expect.poll(previewTop).toBeLessThan(100);

    await scrollRawTo(0.5);
    await expect.poll(previewTop).toBeGreaterThan(100);
  });

  test('cursor position shows in the status bar (FR-10.3)', async ({ page }) => {
    await openRawWithDoc(page, 'line one\nline two');
    await expect(page.getByTestId('status-cursor')).toContainText('L2:C9');
  });

  test('raw mode is byte-faithful — no reformatting on mode switch (FR-3.4)', async ({ page }) => {
    const weird = '*  weird   spacing\n+ plus bullet\n1)  paren list';
    await openRawWithDoc(page, weird);
    // Switch to WYSIWYG placeholder and back.
    await page.keyboard.press('ControlOrMeta+Shift+Digit2');
    await page.keyboard.press('ControlOrMeta+Shift+Digit1');
    await expect(page.locator('.cm-content')).toContainText('*  weird   spacing');
    await expect(page.locator('.cm-content')).toContainText('1)  paren list');
  });
});
