/** Lazy KaTeX loader shared by the WYSIWYG math NodeViews (budget §7). */

let katexPromise: Promise<typeof import('katex').default> | null = null;

export function loadKatex(): Promise<typeof import('katex').default> {
  katexPromise ??= Promise.all([
    import('katex'),
    // Side-effect CSS import; bundled with the same lazy chunk.
    import('katex/dist/katex.min.css'),
  ]).then(([mod]) => mod.default);
  return katexPromise;
}

/**
 * Render LaTeX into an element. Invalid input renders an error chip instead
 * of throwing (FR-5.8).
 */
export async function renderTex(el: HTMLElement, tex: string, displayMode: boolean): Promise<void> {
  const katex = await loadKatex();
  try {
    katex.render(tex, el, { displayMode, throwOnError: true });
  } catch (err) {
    el.textContent = '';
    const chip = document.createElement('span');
    chip.className = 'math-error-chip';
    chip.textContent = `invalid LaTeX: ${err instanceof Error ? err.message.replace(/^KaTeX parse error:\s*/, '') : 'parse error'}`;
    el.appendChild(chip);
  }
}
