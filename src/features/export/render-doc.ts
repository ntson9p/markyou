import { renderMarkdown } from '@/core/markdown/render';
import { renderMermaidBlocks } from '@/editors/preview/mermaid';

/**
 * Render the body to sanitized HTML with Mermaid fences pre-rendered to inline
 * SVG (light theme). Shared by HTML export (FR-11.1), print (FR-11.2) and
 * copy-as-rich-text (FR-11.3) so exports match the preview exactly.
 */
export async function renderDocumentHtml(body: string): Promise<string> {
  const html = await renderMarkdown(body);
  const container = document.createElement('div');
  container.innerHTML = html;
  // Off-screen but *attached*: the diagram canvas repair measures what mermaid
  // actually painted with `getBBox()`, which only reports inside the live
  // document. Rendered detached, an export silently kept whatever broken
  // canvas mermaid declared — and a clipped diagram exports clipped.
  container.style.cssText = 'position:absolute;left:-99999px;top:0;width:46rem';
  document.body.appendChild(container);
  try {
    await renderMermaidBlocks(container, false);
    return container.innerHTML;
  } finally {
    container.remove();
  }
}
