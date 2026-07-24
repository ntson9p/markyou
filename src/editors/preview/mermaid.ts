/**
 * Lazy Mermaid rendering (§6 flavor, R7): the mermaid chunk loads on first
 * use; rendered SVG is cached by (theme, code) so unrelated edits don't
 * re-render diagrams.
 */

type MermaidModule = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidModule> | null = null;
let initializedTheme: string | null = null;
const svgCache = new Map<string, string>();
let renderSeq = 0;

async function getMermaid(dark: boolean): Promise<MermaidModule> {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  const mermaid = await mermaidPromise;
  const theme = dark ? 'dark' : 'default';
  if (initializedTheme !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme });
    initializedTheme = theme;
  }
  return mermaid;
}

export async function renderMermaidToSvg(code: string, dark: boolean): Promise<string> {
  const key = `${dark ? 'd' : 'l'}\u0000${code}`;
  const cached = svgCache.get(key);
  if (cached) return cached;
  const mermaid = await getMermaid(dark);
  const { svg } = await mermaid.render(`mermaid-${++renderSeq}`, code);
  svgCache.set(key, svg);
  if (svgCache.size > 100) {
    const first = svgCache.keys().next().value;
    if (first !== undefined) svgCache.delete(first);
  }
  return svg;
}

/** Replace `pre > code.language-mermaid` blocks inside `root` with rendered SVG. */
export async function renderMermaidBlocks(root: HTMLElement, dark: boolean): Promise<void> {
  const blocks = Array.from(root.querySelectorAll('pre > code.language-mermaid'));
  if (blocks.length === 0) return;

  await Promise.all(
    blocks.map(async (codeEl) => {
      const pre = codeEl.parentElement!;
      const code = codeEl.textContent ?? '';
      const container = document.createElement('div');
      container.className = 'mermaid-diagram';
      container.setAttribute('data-mermaid-source', code);
      try {
        // Mermaid output is generated locally with securityLevel:'strict'
        // (labels sanitized); no document-provided HTML is injected.
        container.innerHTML = await renderMermaidToSvg(code, dark);
      } catch (e) {
        container.className = 'mermaid-error';
        container.textContent = `Mermaid: ${e instanceof Error ? e.message.split('\n')[0] : 'diagram error'}`;
      }
      // The DOM may have re-rendered while we were awaiting.
      if (pre.isConnected) pre.replaceWith(container);
    }),
  );
}
