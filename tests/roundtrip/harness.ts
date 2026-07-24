import { parserCtx, serializerCtx } from '@milkdown/kit/core';

import { createWysiwygEditor, normalizeSerialized } from '@/editors/wysiwyg/create-editor';
import type { MarkdownStylePrefs } from '@/core/markdown/style';

/**
 * Headless round-trip function over the EXACT editor configuration the app
 * ships (same factory, same plugins, same stringify options). f(x) =
 * serialize(parse(x)) — the corpus checks f(f(x)) === f(x) and AST
 * equivalence of f(x) with x (plan §3).
 */
export interface Roundtripper {
  roundtrip: (markdown: string) => string;
  destroy: () => void;
}

export async function createRoundtripper(prefs?: MarkdownStylePrefs): Promise<Roundtripper> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const editor = await createWysiwygEditor({ root, stylePrefs: prefs });

  const parser = editor.ctx.get(parserCtx);
  const serializer = editor.ctx.get(serializerCtx);

  return {
    roundtrip: (markdown: string) => {
      const doc = parser(markdown);
      return normalizeSerialized(doc, serializer(doc));
    },
    destroy: () => {
      void editor.destroy();
      root.remove();
    },
  };
}
