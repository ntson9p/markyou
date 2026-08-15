import { indentWithTab } from '@codemirror/commands';
import { keymap as cmKeymap, type EditorView as CmEditorView } from '@codemirror/view';
import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { exitCode } from '@milkdown/kit/prose/commands';
import { Selection } from '@milkdown/kit/prose/state';

/**
 * Keyboard handling for the CodeMirror-backed code block (FR-5.1).
 *
 * Milkdown's own CM keymap binds only the arrows, Mod-Enter, undo/redo and
 * Backspace, and the NodeView's `stopEvent` hides every key from ProseMirror.
 * Tab therefore fell through to the browser's focus traversal and ejected the
 * caret from the editor, and a code block sitting last in the document had no
 * discoverable way out at all.
 */

/**
 * Move the caret out of the code block and back into the document: into the
 * block that follows when there is one, otherwise into a fresh paragraph
 * appended after it. Returns false when the caret isn't inside a code block.
 */
function exitCodeBlockForward(ctx: Ctx): boolean {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { $head } = state.selection;
  if (!$head.parent.type.spec.code) return false;

  const after = $head.after();
  if (after < state.doc.content.size) {
    const selection = Selection.near(state.doc.resolve(after), 1);
    // `Selection.near` falls back *backwards* when nothing follows, which
    // would land us right back inside the block we're trying to leave.
    if (!selection.$head.parent.type.spec.code) {
      view.dispatch(state.tr.setSelection(selection).scrollIntoView());
      view.focus();
      return true;
    }
  }

  if (!exitCode(state, view.dispatch)) return false;
  view.focus();
  return true;
}

/** Enter on a blank trailing line leaves the block, consuming that line. */
function exitOnBlankLastLine(ctx: Ctx, cm: CmEditorView): boolean {
  const { state } = cm;
  const { main } = state.selection;
  if (!main.empty) return false;
  // A one-line block is still being started — Backspace is the way out there.
  if (state.doc.lines < 2) return false;
  const line = state.doc.lineAt(main.head);
  if (line.number !== state.doc.lines) return false;
  if (line.text.trim().length > 0) return false;

  // Drop the blank line together with the newline that produced it, so
  // exiting doesn't leave trailing whitespace in the fence.
  cm.dispatch({ changes: { from: line.from - 1, to: line.to } });
  return exitCodeBlockForward(ctx);
}

/**
 * CodeMirror extension for the code-block editor. Registered after Milkdown's
 * own keymap, so these bindings only fill the gaps it leaves.
 */
export function codeBlockKeymap(ctx: Ctx) {
  return cmKeymap.of([
    // Tab/Shift+Tab indent like any code editor.
    indentWithTab,
    // …and Escape is the escape hatch that keeps the block from becoming a
    // keyboard trap now that Tab no longer traverses out (WCAG 2.1.2).
    { key: 'Escape', run: () => exitCodeBlockForward(ctx) },
    { key: 'Enter', run: (cm) => exitOnBlankLastLine(ctx, cm) },
  ]);
}
