import type { MarkType } from '@milkdown/kit/prose/model';
import type { EditorState } from '@milkdown/kit/prose/state';

/**
 * Selection state driving the fixed toolbar's reflection (FR-5.2): which
 * inline marks are active and which block context the caret sits in.
 */

export type BlockType =
  'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote' | 'code' | 'callout' | 'other';

export interface WysiwygSelectionState {
  strong: boolean;
  emphasis: boolean;
  strikethrough: boolean;
  inlineCode: boolean;
  link: boolean;
  blockType: BlockType;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  inTable: boolean;
}

/** Shallow equality over the flat selection-state record. */
export function selectionStatesEqual(a: WysiwygSelectionState, b: WysiwygSelectionState): boolean {
  return (Object.keys(a) as (keyof WysiwygSelectionState)[]).every((key) => a[key] === b[key]);
}

export const INITIAL_SELECTION_STATE: WysiwygSelectionState = {
  strong: false,
  emphasis: false,
  strikethrough: false,
  inlineCode: false,
  link: false,
  blockType: 'paragraph',
  bulletList: false,
  orderedList: false,
  taskList: false,
  inTable: false,
};

function isMarkActive(state: EditorState, type: MarkType | undefined): boolean {
  if (!type) return false;
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

export function computeSelectionState(state: EditorState): WysiwygSelectionState {
  const { marks } = state.schema;
  const { $from } = state.selection;

  let blockType: BlockType = 'other';
  let bulletList = false;
  let orderedList = false;
  let taskList = false;
  let inTable = false;

  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    switch (node.type.name) {
      case 'paragraph':
        if (blockType === 'other') blockType = 'paragraph';
        break;
      case 'heading':
        if (blockType === 'other' || blockType === 'paragraph') {
          blockType = `h${node.attrs.level as number}` as BlockType;
        }
        break;
      case 'code_block':
        blockType = 'code';
        break;
      case 'blockquote':
        if (blockType !== 'code') blockType = 'quote';
        break;
      case 'callout':
        if (blockType !== 'code') blockType = 'callout';
        break;
      case 'bullet_list':
        bulletList = true;
        break;
      case 'ordered_list':
        orderedList = true;
        break;
      case 'list_item':
        if (node.attrs.checked != null) taskList = true;
        break;
      case 'table':
        inTable = true;
        break;
    }
  }

  // Depth-0 selections (select-all, doc-level node selections) have no
  // ancestor blocks — classify the first selected block instead.
  if (blockType === 'other' && $from.depth === 0 && $from.nodeAfter) {
    const node = $from.nodeAfter;
    if (node.type.name === 'paragraph') blockType = 'paragraph';
    else if (node.type.name === 'heading') {
      blockType = `h${node.attrs.level as number}` as BlockType;
    } else if (node.type.name === 'code_block') blockType = 'code';
    else if (node.type.name === 'blockquote') blockType = 'quote';
    else if (node.type.name === 'callout') blockType = 'callout';
  }

  return {
    strong: isMarkActive(state, marks.strong),
    emphasis: isMarkActive(state, marks.emphasis),
    strikethrough: isMarkActive(state, marks.strike_through),
    inlineCode: isMarkActive(state, marks.inlineCode),
    link: isMarkActive(state, marks.link),
    blockType,
    bulletList,
    orderedList,
    taskList,
    inTable,
  };
}
