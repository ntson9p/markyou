import { bulletListSchema } from '@milkdown/kit/preset/commonmark';
import { wrapIn } from '@milkdown/kit/prose/commands';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { $command } from '@milkdown/kit/utils';

import { CALLOUT_TYPES, type CalloutType } from '@/core/markdown/callouts';

import { calloutSchema } from './nodes/callout';
import { diagramSchema } from './nodes/diagram';
import { mathBlockSchema, mathInlineSchema } from './nodes/math';

/** Insert `$…$` inline math at the selection (FR-5.8). */
export const insertMathInlineCommand = $command(
  'InsertMathInline',
  (ctx) =>
    (value = '') =>
    (state, dispatch) => {
      const type = mathInlineSchema.type(ctx);
      const node = type.create({ value });
      if (dispatch) {
        const tr = state.tr.replaceSelectionWith(node);
        const pos = tr.selection.from - node.nodeSize;
        dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)).scrollIntoView());
      }
      return true;
    },
);

/** Insert a `$$…$$` math block at the selection (FR-5.8). */
export const insertMathBlockCommand = $command(
  'InsertMathBlock',
  (ctx) =>
    (value = '') =>
    (state, dispatch) => {
      const type = mathBlockSchema.type(ctx);
      if (dispatch) {
        const tr = state.tr.replaceSelectionWith(type.create({ value }));
        dispatch(tr.scrollIntoView());
      }
      return true;
    },
);

/** Insert a mermaid diagram block (FR-5.9). */
export const insertDiagramCommand = $command(
  'InsertDiagram',
  (ctx) =>
    (value = 'graph TD\n  A[Start] --> B[End]') =>
    (state, dispatch) => {
      const type = diagramSchema.type(ctx);
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(type.create({ value })).scrollIntoView());
      }
      return true;
    },
);

/**
 * Wrap the selection in a callout, or retype the enclosing callout when
 * already inside one (FR-5.10).
 */
export const wrapInCalloutCommand = $command(
  'WrapInCallout',
  (ctx) =>
    (calloutType: CalloutType = CALLOUT_TYPES[0]) =>
    (state, dispatch) => {
      const type = calloutSchema.type(ctx);
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type === type) {
          dispatch?.(
            state.tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, calloutType }),
          );
          return true;
        }
      }
      return wrapIn(type, { calloutType })(state, dispatch);
    },
);

/**
 * Toggle task-list state (FR-5.2): items in the selection become tasks
 * (checked=false); if all are already tasks, they revert to plain items.
 * Outside a list, wraps in a bullet list first.
 */
export const toggleTaskListCommand = $command(
  'ToggleTaskList',
  (ctx) => () => (state, dispatch, view) => {
    const collectItems = (doc: ProseNode, from: number, to: number) => {
      const items: { pos: number; node: ProseNode }[] = [];
      doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === 'list_item') items.push({ pos, node });
      });
      return items;
    };

    const { from, to } = state.selection;
    let items = collectItems(state.doc, from, to);

    if (items.length === 0) {
      // Wrap in a bullet list first, then mark the fresh items as tasks.
      const wrapped = wrapIn(bulletListSchema.type(ctx))(state, dispatch);
      if (!wrapped || !dispatch || !view) return wrapped;
      const next = view.state;
      items = collectItems(next.doc, next.selection.from, next.selection.to);
      if (items.length === 0) return true;
      let tr = next.tr;
      for (const { pos, node } of items) {
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false });
      }
      dispatch(tr);
      return true;
    }

    const makeTasks = items.some(({ node }) => node.attrs.checked == null);
    if (dispatch) {
      let tr = state.tr;
      for (const { pos, node } of items) {
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: makeTasks ? false : null });
      }
      dispatch(tr);
    }
    return true;
  },
);

export const wysiwygCommands = [
  insertMathInlineCommand,
  insertMathBlockCommand,
  insertDiagramCommand,
  wrapInCalloutCommand,
  toggleTaskListCommand,
];
