import { buildStandaloneHtml } from './html-standalone';

/**
 * Print-to-PDF (FR-11.2): render the self-contained document into a hidden
 * iframe (so only the content prints, not the app chrome) and open the browser
 * print dialog. The print stylesheet (page margins + break-avoid rules) lives
 * in the standalone HTML.
 */
export async function printDocument(title: string, body: string): Promise<void> {
  const html = await buildStandaloneHtml(title, body);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error('Could not open a print document.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  // Let styles/fonts and Mermaid SVG lay out before printing.
  await new Promise((resolve) => setTimeout(resolve, 350));
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => iframe.remove(), 1000);
}
