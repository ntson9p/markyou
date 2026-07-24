import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

/**
 * Empty-document placeholder (M4 polish): prompts the user in a fresh, empty
 * block. Rendered as a node decoration (`data-placeholder`), styled via CSS —
 * no DOM churn, no serialized content.
 */
const PLACEHOLDER = "Type '/' for commands, or just start writing…";

export const placeholderPlugin = $prose(
  () =>
    new Plugin({
      props: {
        decorations: (state) => {
          const { doc } = state;
          if (doc.childCount !== 1) return null;
          const first = doc.firstChild;
          if (!first || first.content.size > 0) return null;
          if (first.type.name !== 'paragraph' && first.type.name !== 'heading') return null;
          return DecorationSet.create(doc, [
            Decoration.node(0, first.nodeSize, {
              class: 'is-empty',
              'data-placeholder': PLACEHOLDER,
            }),
          ]);
        },
      },
    }),
);
