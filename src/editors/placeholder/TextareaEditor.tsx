import { getFullText, useDocStore } from '@/core/document/store';

/**
 * M1 placeholder editor: a plain textarea exercising the full document
 * lifecycle end-to-end. Replaced by the CodeMirror adapter in M2.
 */
export function TextareaEditor() {
  const body = useDocStore((s) => s.body);
  const frontmatter = useDocStore((s) => s.frontmatter);
  const setFullText = useDocStore((s) => s.setFullText);

  const fullText = getFullText({ body, frontmatter });

  return (
    <textarea
      className="h-full w-full resize-none bg-background p-4 font-mono text-sm outline-none"
      aria-label="Markdown source"
      data-testid="editor-textarea"
      value={fullText}
      onChange={(e) => setFullText(e.target.value, 'raw')}
      spellCheck={false}
    />
  );
}
