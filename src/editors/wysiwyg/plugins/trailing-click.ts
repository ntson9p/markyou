import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

/**
 * Clicking the empty space below the document should extend it, not jump to
 * the top of it.
 *
 * When the last block keeps its content out of ProseMirror's DOM map,
 * `posAtCoords` can't resolve a position in that gutter and silently falls
 * back to position 0 — so the next keystroke lands at the very start of the
 * document. Append a paragraph and put the caret there instead, which is what
 * the click plainly meant.
 */

/**
 * Blocks that can't take the caret from a click below them: atoms (math
 * blocks, diagrams, rules) and the two whose editing surface belongs to a
 * NodeView rather than to ProseMirror. Prose containers — paragraphs,
 * headings, quotes, callouts, lists — resolve gutter clicks correctly on
 * their own and are deliberately left alone.
 */
const NODE_VIEW_BLOCKS = new Set(['code_block', 'table']);

function needsTrailingParagraph(last: ProseNode): boolean {
  return last.isAtom || NODE_VIEW_BLOCKS.has(last.type.name);
}

export const trailingClickPlugin = $prose(
  (ctx) =>
    new Plugin({
      props: {
        handleDOMEvents: {
          mousedown: (view, event) => {
            if (!view.editable || event.button !== 0) return false;
            // Only the editor's own padding — never a click on real content.
            if (event.target !== view.dom) return false;

            const last = view.state.doc.lastChild;
            if (!last || !needsTrailingParagraph(last)) return false;

            const dom = view.nodeDOM(view.state.doc.content.size - last.nodeSize);
            if (!(dom instanceof HTMLElement)) return false;
            if (event.clientY <= dom.getBoundingClientRect().bottom) return false;

            const end = view.state.doc.content.size;
            const tr = view.state.tr.insert(end, paragraphSchema.type(ctx).create());
            tr.setSelection(TextSelection.near(tr.doc.resolve(end), 1));
            view.dispatch(tr.scrollIntoView());
            view.focus();
            event.preventDefault();
            return true;
          },
        },
      },
    }),
);
