import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

import { parseCalloutMarker } from '@/core/markdown/callouts';
import {
  INITIAL_SELECTION_STATE,
  type BlockType,
  type WysiwygSelectionState,
} from '@/editors/wysiwyg/selection-state';

/**
 * Toolbar reflection for the source pane (dual mode): classify the caret's
 * markdown context from CodeMirror's Lezer tree into the same selection-state
 * shape the WYSIWYG pane produces, so the shared toolbar lights up identically
 * over both panes. Mirrors `computeSelectionState`'s precedence rules: an
 * enclosing quote/callout wins over an inner heading; code beats everything.
 */

/** Parse budget — nearly always a cache hit, since highlighting keeps the viewport parsed. */
const PARSE_TIMEOUT_MS = 20;

const ATX_RE = /^ATXHeading([1-6])$/;
const SETEXT_RE = /^SetextHeading([12])$/;

/** A blockquote is a callout when its first line starts with a `[!type]` marker. */
function isCallout(state: EditorState, quote: SyntaxNode): boolean {
  const line = state.doc.lineAt(quote.from);
  const m = /^\s*>\s?(.*)$/.exec(line.text);
  return m !== null && parseCalloutMarker(m[1]) !== null;
}

export function computeRawSelectionState(state: EditorState): WysiwygSelectionState {
  const head = state.selection.main.head;
  const tree =
    ensureSyntaxTree(state, Math.min(state.doc.length, head + 1), PARSE_TIMEOUT_MS) ??
    syntaxTree(state);

  const result: WysiwygSelectionState = { ...INITIAL_SELECTION_STATE, blockType: 'other' };

  // Innermost → outermost, applying the same overrides as the WYSIWYG walk.
  for (let node: SyntaxNode | null = tree.resolveInner(head, -1); node; node = node.parent) {
    const name = node.type.name;
    const heading = ATX_RE.exec(name) ?? SETEXT_RE.exec(name);
    if (heading) {
      if (result.blockType === 'other' || result.blockType === 'paragraph') {
        result.blockType = `h${heading[1]}` as BlockType;
      }
      continue;
    }
    switch (name) {
      case 'StrongEmphasis':
        result.strong = true;
        break;
      case 'Emphasis':
        result.emphasis = true;
        break;
      case 'Strikethrough':
        result.strikethrough = true;
        break;
      case 'InlineCode':
        result.inlineCode = true;
        break;
      case 'Link':
        result.link = true;
        break;
      case 'Paragraph':
        if (result.blockType === 'other') result.blockType = 'paragraph';
        break;
      case 'FencedCode':
      case 'CodeBlock':
        result.blockType = 'code';
        break;
      case 'Blockquote':
        if (result.blockType !== 'code') {
          result.blockType = isCallout(state, node) ? 'callout' : 'quote';
        }
        break;
      case 'BulletList':
        result.bulletList = true;
        break;
      case 'OrderedList':
        result.orderedList = true;
        break;
      case 'Task':
        result.taskList = true;
        break;
      case 'Table':
        result.inTable = true;
        break;
    }
  }
  return result;
}
