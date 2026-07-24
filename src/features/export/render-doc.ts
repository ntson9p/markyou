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
  await renderMermaidBlocks(container, false);
  return container.innerHTML;
}
