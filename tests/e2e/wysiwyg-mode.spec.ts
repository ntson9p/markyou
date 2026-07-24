import { expect, test, type Page } from '@playwright/test';

import { getFakeDisk, seedFakeFile, stubFsa } from './helpers';

/** A nontrivial document exercising most of the flavor table (§6). */
const README = [
  '# MarkYou Sample',
  '',
  'A paragraph with **bold**, *italic*, `code`, ~~strike~~ and a [link](https://example.com).',
  '',
  '## Features',
  '',
  '- tight item one',
  '- tight item two',
  '',
  '1. ordered one',
  '2. ordered two',
  '',
  '- [x] shipped',
  '- [ ] pending',
  '',
  '> [!warning] Careful',
  '> Callouts render as styled boxes.',
  '',
  '| Col A | Col B |',
  '| ----- | ----- |',
  '| 1     | 2     |',
  '',
  '```ts',
  'const x: number = 1;',
  '```',
  '',
  'Inline math $e^{i\\pi}+1=0$ and a block:',
  '',
  '$$',
  '\\int_0^1 x\\,dx',
  '$$',
  '',
  '<div class="custom">raw html block</div>',
  '',
  '[unused-def]: https://example.com/kept "Kept definition"',
  '',
  'The end.',
].join('\n');

async function newWysiwygDoc(page: Page) {
  await page.goto('/');
  await page.getByTestId('welcome-new').click();
  // WYSIWYG is the default mode (D3); the engine is a lazy chunk.
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 15000 });
  await page.locator('.ProseMirror').click();
}

const editor = (page: Page) => page.locator('.ProseMirror');

test.describe('WYSIWYG mode (FR-5)', () => {
  test('typing with input rules produces headings, emphasis and lists (FR-5.3)', async ({
    page,
  }) => {
    await newWysiwygDoc(page);

    await page.keyboard.type('# Title');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Some **bold** move');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- item one');

    await expect(editor(page).locator('h1')).toHaveText('Title');
    await expect(editor(page).locator('strong')).toHaveText('bold');
    await expect(editor(page).locator('ul li')).toContainText('item one');
    // Zero syntax leakage: markers were consumed, not rendered.
    await expect(editor(page)).not.toContainText('#');
    await expect(editor(page)).not.toContainText('**');
  });

  test('toolbar formats the selection and reflects its state (FR-5.2)', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('make me strong');
    await page.keyboard.press('ControlOrMeta+a');

    const bold = page.getByRole('button', { name: 'Bold (Ctrl+B)' });
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await bold.click();
    await expect(editor(page).locator('strong')).toHaveText('make me strong');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    // Block type dropdown converts the paragraph to a heading.
    await page.getByTestId('block-type-trigger').click();
    await page.getByRole('menuitem', { name: 'Heading 2' }).click();
    await expect(editor(page).locator('h2')).toContainText('make me strong');
    await expect(page.getByTestId('block-type-trigger')).toContainText('Heading 2');
  });

  test('keyboard shortcuts: bold, italic, inline code (FR-5.3, §9.3)', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('shortcut target');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(editor(page).locator('strong')).toHaveText('shortcut target');
    await page.keyboard.press('ControlOrMeta+i');
    await expect(editor(page).locator('em')).toHaveText('shortcut target');
    await page.keyboard.press('ControlOrMeta+e');
    await expect(editor(page).locator('code')).toHaveText('shortcut target');
  });

  test('table insert renders an editable table (FR-5.13)', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.getByRole('button', { name: 'Insert table' }).click();
    // The table-block component renders the content into `table.children`.
    await expect(editor(page).locator('table.children')).toBeVisible();
    expect(await editor(page).locator('table.children tr').count()).toBe(3);
  });

  test('math input rule renders KaTeX; click opens the source editor (FR-5.8)', async ({
    page,
  }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('Euler: $e^{i\\pi}+1=0$');

    const math = editor(page).locator('[data-type="math-inline"]');
    await expect(math).toBeVisible();
    await expect(math.locator('.katex')).toBeVisible();

    await math.click();
    const popover = page.getByRole('dialog', { name: 'Edit inline math (LaTeX)' });
    await expect(popover).toBeVisible();
    await popover.locator('textarea').fill('x^2');
    await popover.getByRole('button', { name: 'Apply' }).click();
    await expect(math.locator('.katex')).toContainText('x');
  });

  test('invalid LaTeX shows a graceful error chip (FR-5.8)', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('$\\frac{$');
    await expect(editor(page).locator('.math-error-chip')).toBeVisible();
  });

  test('blockquote converts to a callout via [!type] (FR-5.10)', async ({ page }) => {
    await newWysiwygDoc(page);
    // "> " wraps in a blockquote; "[!tip] " converts it to a callout.
    await page.keyboard.type('> [!tip] ');
    await page.keyboard.type('use callouts');

    const callout = editor(page).locator('.callout-tip');
    await expect(callout).toBeVisible();
    await expect(callout.locator('.callout-title-text')).toHaveText('Tip');
    await expect(callout).toContainText('use callouts');

    // The type picker switches the callout kind in place.
    await callout.locator('.callout-picker').selectOption('warning');
    await expect(editor(page).locator('.callout-warning')).toBeVisible();
  });

  test('code block has a language picker with highlighting (FR-5.1)', async ({ page }) => {
    await newWysiwygDoc(page);
    // The fence input rule triggers on trailing whitespace.
    await page.keyboard.type('``` ');

    const codeBlock = editor(page).locator('.milkdown-code-block');
    await expect(codeBlock).toBeVisible();
    await codeBlock.locator('.language-button').click();
    await codeBlock.locator('.search-input').fill('typescript');
    await codeBlock.locator('.language-list-item', { hasText: 'typescript' }).first().click();
    await expect(codeBlock.locator('.language-button')).toContainText(/typescript/i);

    await codeBlock.locator('.cm-content').click();
    await page.keyboard.type('const n: number = 42;');
    await expect(codeBlock.locator('.cm-content')).toContainText('const n: number = 42;');
  });

  test('a nontrivial README renders with zero syntax leakage (M3 exit)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'sample.md', README);
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(editor(page)).toBeVisible({ timeout: 15000 });

    const doc = editor(page);
    await expect(doc.locator('h1')).toHaveText('MarkYou Sample');
    await expect(doc.locator('strong').first()).toHaveText('bold');
    await expect(doc.locator('table.children')).toBeVisible();
    await expect(doc.locator('.callout-warning')).toContainText('Callouts render as styled boxes.');
    await expect(doc.locator('[data-type="math-inline"] .katex')).toBeVisible();
    await expect(doc.locator('[data-type="math-block"]')).toBeVisible();
    await expect(doc.locator('.milkdown-code-block')).toBeVisible();
    // Raw HTML survives as an inert chip, not rendered markup (FR-5.11).
    await expect(doc.locator('.html-chip-block')).toContainText('raw html block');
    // The unused link definition is preserved as a chip, not dropped.
    await expect(doc.locator('.definition-chip')).toContainText('unused-def');

    // No literal markdown tokens leak into the rendered document.
    const text = (await doc.innerText()).replace(/[\s\u200b]+/g, ' ');
    expect(text).not.toContain('**');
    expect(text).not.toContain('~~');
    expect(text).not.toContain('# MarkYou');
    expect(text).not.toContain('| Col A |');
  });

  test('editing preserves untouched constructs byte-for-byte on save (D13)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'sample.md', README);
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(editor(page)).toBeVisible({ timeout: 15000 });

    // Append a word to the last paragraph.
    await editor(page).locator('p', { hasText: 'The end.' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Edited.');
    await expect(editor(page)).toContainText('The end. Edited.');
    await page.waitForTimeout(600); // push debounce

    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');

    const disk = await getFakeDisk(page);
    const saved = disk['sample.md'];
    expect(saved).toContain('The end. Edited.');
    // Untouched constructs survive: html verbatim, definition, math, callout.
    expect(saved).toContain('<div class="custom">raw html block</div>');
    expect(saved).toContain('[unused-def]: https://example.com/kept "Kept definition"');
    expect(saved).toContain('$e^{i\\pi}+1=0$');
    expect(saved).toContain('\\int_0^1 x\\,dx');
    // Callout markers normalize to the canonical uppercase form (D13).
    expect(saved).toContain('[!WARNING] Careful');
    expect(saved).toContain('const x: number = 1;');
    expect(saved).toContain('- [x] shipped');
  });

  test('frontmatter never appears in WYSIWYG (FR-5.12)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'fm.md', '---\ntitle: Secret Meta\n---\n\n# Visible Body\n');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(editor(page)).toBeVisible({ timeout: 15000 });

    await expect(editor(page).locator('h1')).toHaveText('Visible Body');
    await expect(editor(page)).not.toContainText('Secret Meta');

    // Raw mode still shows it (FR-5.12) — and it survives a WYSIWYG session.
    await page.keyboard.press('ControlOrMeta+Shift+Digit1');
    await expect(page.locator('.cm-content')).toContainText('title: Secret Meta');
  });

  test('undo/redo through the toolbar (FR-5.2)', async ({ page }) => {
    await newWysiwygDoc(page);
    await page.keyboard.type('first line');
    await expect(editor(page)).toContainText('first line');

    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect(editor(page)).not.toContainText('first line');
    await page.getByRole('button', { name: 'Redo (Ctrl+Y)' }).click();
    await expect(editor(page)).toContainText('first line');
  });

  test('task list checkbox toggles by click and serializes (FR-5.7)', async ({ page }) => {
    await stubFsa(page);
    await seedFakeFile(page, 'tasks.md', '- [ ] buy milk\n- [x] write tests\n');
    await page.goto('/');
    await page.getByTestId('welcome-open').click();
    await expect(editor(page)).toBeVisible({ timeout: 15000 });

    const items = editor(page).locator('.milkdown-list-item-block');
    await expect(items).toHaveCount(2);
    await items.first().locator('.label-wrapper').click();
    await page.waitForTimeout(600); // push debounce

    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByTestId('status-save')).toContainText('Saved');
    const disk = await getFakeDisk(page);
    expect(disk['tasks.md']).toContain('- [x] buy milk');
  });
});
