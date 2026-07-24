import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { Command } from '@codemirror/view';

/**
 * Source-level formatting shortcuts (FR-3.5): operate on markdown text like
 * VS Code — Ctrl+B wraps the selection in `**`, etc. Raw mode never reformats
 * anything outside the selection (D13).
 */

/** Toggle an inline wrapper (e.g. `**`, `*`, `~~`, `` ` ``) around each selection. */
export function toggleInlineMark(marker: string): Command {
  return (view) => {
    const changes = view.state.changeByRange((range) => {
      const { from, to } = range;
      const len = marker.length;
      const before = view.state.sliceDoc(Math.max(0, from - len), from);
      const after = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + len));
      const inner = view.state.sliceDoc(from, to);

      // Unwrap: markers just outside the selection.
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: from - len, to: from },
            { from: to, to: to + len },
          ],
          range: EditorSelection.range(from - len, to - len),
        };
      }
      // Unwrap: markers included in the selection.
      if (inner.length >= 2 * len && inner.startsWith(marker) && inner.endsWith(marker)) {
        return {
          changes: [
            { from, to: from + len },
            { from: to - len, to },
          ],
          range: EditorSelection.range(from, to - 2 * len),
        };
      }
      // Wrap.
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker },
        ],
        range: EditorSelection.range(from + len, to + len),
      };
    });
    view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' });
    return true;
  };
}

const LINE_PREFIX_RE = /^(\s*)((?:[-*+]\s\[[ xX]\]|[-*+]|\d+[.)]|>|#{1,6})\s+)?/;

/**
 * Toggle a block prefix on all selected lines.
 * kind 'heading' cycles/sets `#`-runs; others set/remove their marker.
 */
export function toggleLinePrefix(prefix: string): Command {
  return (view) => {
    const state = view.state;
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
      const fromLine = state.doc.lineAt(range.from).number;
      const toLine = state.doc.lineAt(range.to).number;
      for (let l = fromLine; l <= toLine; l++) lines.add(l);
    }

    const changes: ChangeSpec[] = [];
    // If every selected non-empty line already has this exact prefix → remove it.
    const lineInfos = [...lines].map((n) => state.doc.line(n));
    const nonEmpty = lineInfos.filter((l) => l.text.trim() !== '');
    const target = nonEmpty.length > 0 ? nonEmpty : lineInfos;
    const allHave =
      target.length > 0 &&
      target.every((l) => {
        const m = LINE_PREFIX_RE.exec(l.text);
        return m?.[2]?.trimEnd() === prefix.trimEnd();
      });

    for (const line of target) {
      const m = LINE_PREFIX_RE.exec(line.text)!;
      const indent = m[1] ?? '';
      const existing = m[2] ?? '';
      const start = line.from + indent.length;
      if (allHave) {
        changes.push({ from: start, to: start + existing.length });
      } else {
        changes.push({ from: start, to: start + existing.length, insert: prefix });
      }
    }
    if (changes.length === 0) return false;
    view.dispatch({ changes, userEvent: 'input' });
    return true;
  };
}

/** Set heading level 1–6 (replaces an existing heading prefix; toggles off when same). */
export function setHeading(level: number): Command {
  return toggleLinePrefix(`${'#'.repeat(level)} `);
}

/** Insert or wrap a markdown link: `[selection](url)` with `url` selected. */
export const insertLink: Command = (view) => {
  const changes = view.state.changeByRange((range) => {
    const text = view.state.sliceDoc(range.from, range.to) || 'link text';
    const insert = `[${text}](url)`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 3),
    };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' });
  return true;
};

export const formatCommands = {
  bold: toggleInlineMark('**'),
  italic: toggleInlineMark('*'),
  strikethrough: toggleInlineMark('~~'),
  inlineCode: toggleInlineMark('`'),
  link: insertLink,
  bulletList: toggleLinePrefix('- '),
  orderedList: toggleLinePrefix('1. '),
  taskList: toggleLinePrefix('- [ ] '),
  quote: toggleLinePrefix('> '),
  h1: setHeading(1),
  h2: setHeading(2),
  h3: setHeading(3),
};
