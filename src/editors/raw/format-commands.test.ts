import { afterEach, describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { formatCommands } from '@/editors/raw/format-commands';

let views: EditorView[] = [];

function makeView(doc: string, from: number, to = from): EditorView {
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(from, to),
    extensions: [],
  });
  const view = new EditorView({ state, parent: document.body });
  views.push(view);
  return view;
}

afterEach(() => {
  views.forEach((v) => v.destroy());
  views = [];
});

describe('raw formatting commands (FR-3.5)', () => {
  it('Ctrl+B wraps a selection in ** like VS Code', () => {
    const view = makeView('make this bold', 5, 9);
    formatCommands.bold(view);
    expect(view.state.doc.toString()).toBe('make **this** bold');
    // Selection stays on the word.
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'this',
    );
  });

  it('unwraps when the selection is already bold', () => {
    const view = makeView('a **bold** z', 4, 8);
    formatCommands.bold(view);
    expect(view.state.doc.toString()).toBe('a bold z');
  });

  it('unwraps when markers are inside the selection', () => {
    const view = makeView('a **bold** z', 2, 10);
    formatCommands.bold(view);
    expect(view.state.doc.toString()).toBe('a bold z');
  });

  it('inserts an empty pair at the cursor', () => {
    const view = makeView('ab', 1);
    formatCommands.italic(view);
    expect(view.state.doc.toString()).toBe('a**b');
    expect(view.state.selection.main.head).toBe(2);
  });

  it('toggles strikethrough and inline code', () => {
    const strike = makeView('word', 0, 4);
    formatCommands.strikethrough(strike);
    expect(strike.state.doc.toString()).toBe('~~word~~');

    const code = makeView('word', 0, 4);
    formatCommands.inlineCode(code);
    expect(code.state.doc.toString()).toBe('`word`');
  });

  it('wraps a selection as a link with the url placeholder selected', () => {
    const view = makeView('see docs here', 4, 8);
    formatCommands.link(view);
    expect(view.state.doc.toString()).toBe('see [docs](url) here');
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      'url',
    );
  });

  it('sets and toggles heading levels', () => {
    const view = makeView('Title', 2);
    formatCommands.h2(view);
    expect(view.state.doc.toString()).toBe('## Title');
    formatCommands.h2(view);
    expect(view.state.doc.toString()).toBe('Title');
  });

  it('replaces one heading level with another', () => {
    const view = makeView('# Title', 3);
    formatCommands.h3(view);
    expect(view.state.doc.toString()).toBe('### Title');
  });

  it('toggles bullet lists across multiple lines', () => {
    const view = makeView('one\ntwo\nthree', 0, 13);
    formatCommands.bulletList(view);
    expect(view.state.doc.toString()).toBe('- one\n- two\n- three');
    formatCommands.bulletList(view);
    expect(view.state.doc.toString()).toBe('one\ntwo\nthree');
  });

  it('converts a bullet list to a task list', () => {
    const view = makeView('- one\n- two', 0, 11);
    formatCommands.taskList(view);
    expect(view.state.doc.toString()).toBe('- [ ] one\n- [ ] two');
  });

  it('toggles blockquote', () => {
    const view = makeView('quote me', 0);
    formatCommands.quote(view);
    expect(view.state.doc.toString()).toBe('> quote me');
  });

  it('preserves indentation when toggling list prefixes', () => {
    const view = makeView('  nested', 4);
    formatCommands.bulletList(view);
    expect(view.state.doc.toString()).toBe('  - nested');
  });
});
