import { renderDocumentHtml } from './render-doc';

/**
 * Copy the document as rich text (FR-11.3): writes both a `text/html` flavor
 * (for Docs/Word/email) and a `text/plain` markdown flavor to the clipboard.
 * Falls back to plain markdown where the async Clipboard API is unavailable.
 */
export async function copyAsRichText(body: string): Promise<void> {
  const html = `<div class="md-doc">${await renderDocumentHtml(body)}</div>`;

  const clipboard = navigator.clipboard as Clipboard | undefined;
  if (clipboard && 'write' in clipboard && typeof ClipboardItem !== 'undefined') {
    await clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([body], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(body);
}
