import { expect, test, type Page } from '@playwright/test';

import { pinMode, seedFakeFile, stubFsa } from './helpers';

// A valid 1×1 transparent PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_DATA_URI = `data:image/png;base64,${PNG_B64}`;

async function openWysiwyg(page: Page, content: string) {
  await stubFsa(page);
  await seedFakeFile(page, 'doc.md', content);
  await pinMode(page, 'wysiwyg');
  await page.goto('/');
  await page.getByTestId('welcome-open').click();
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
}

/** Dispatch a synthetic paste carrying an image file onto `selector`. */
async function pasteImage(page: Page, selector: string) {
  await page.locator(selector).evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'pic.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, PNG_B64);
}

test.describe('images (FR-8)', () => {
  test('WYSIWYG paste embeds an inline data URI when no folder is set (FR-8.1, FR-8.3)', async ({
    page,
    browserName,
  }) => {
    // Synthetic clipboardData with files is only honoured by Chromium.
    test.skip(browserName === 'firefox', 'Firefox ignores synthetic clipboardData');
    await openWysiwyg(page, '# Images\n\nStart.\n');
    await page.locator('.ProseMirror').click();

    await pasteImage(page, '.ProseMirror');

    const img = page.locator('.ProseMirror .md-image img');
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/, { timeout: 10000 });
    await expect(img).toHaveAttribute('alt', 'pic');
  });

  test('raw paste inserts a markdown image with a data URI (FR-8.1)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'Firefox ignores synthetic clipboardData');
    await stubFsa(page);
    await seedFakeFile(page, 'doc.md', '# Doc\n\n');
    await pinMode(page, 'raw');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+End');

    await pasteImage(page, '.cm-content');

    await expect(page.locator('.cm-content')).toContainText('![pic](data:image/png;base64,', {
      timeout: 10000,
    });
  });

  test('clicking an image opens a popover to edit alt text and remove it (FR-8.5)', async ({
    page,
  }) => {
    await openWysiwyg(page, `# Pic\n\n![cat](${PNG_DATA_URI})\n`);

    const img = page.locator('.ProseMirror .md-image img');
    await expect(img).toBeVisible();
    await img.click();

    const popover = page.locator('.image-popover');
    await expect(popover).toBeVisible();
    const input = popover.locator('.image-popover-input');
    await expect(input).toHaveValue('cat');

    await input.fill('a napping kitten');
    await expect(img).toHaveAttribute('alt', 'a napping kitten');

    await popover.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.ProseMirror .md-image')).toHaveCount(0);
  });
});
