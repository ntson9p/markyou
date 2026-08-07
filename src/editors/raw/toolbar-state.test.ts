import { describe, expect, it } from 'vitest';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorSelection, EditorState } from '@codemirror/state';

import { computeRawSelectionState } from '@/editors/raw/toolbar-state';

/** Selection state with the caret placed at `doc.indexOf(needle)` (+ offset). */
function stateAt(doc: string, needle: string, offset = 1) {
  const pos = doc.indexOf(needle);
  if (pos < 0) throw new Error(`needle not found: ${needle}`);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.single(pos + offset),
    extensions: [markdown({ base: markdownLanguage })],
  });
  return computeRawSelectionState(state);
}

describe('computeRawSelectionState (dual-mode toolbar reflection)', () => {
  it('classifies a plain paragraph', () => {
    const s = stateAt('just some text', 'some');
    expect(s.blockType).toBe('paragraph');
    expect(s.strong).toBe(false);
    expect(s.bulletList).toBe(false);
  });

  it('detects inline marks at the caret', () => {
    expect(stateAt('a **bold** z', 'bold').strong).toBe(true);
    expect(stateAt('a *ital* z', 'ital').emphasis).toBe(true);
    expect(stateAt('a ~~gone~~ z', 'gone').strikethrough).toBe(true);
    expect(stateAt('a `code` z', 'code').inlineCode).toBe(true);
    expect(stateAt('a [text](url) z', 'text').link).toBe(true);
  });

  it('does not light marks outside their span', () => {
    const s = stateAt('a **bold** plain', 'plain');
    expect(s.strong).toBe(false);
  });

  it('maps ATX and Setext headings to hN', () => {
    expect(stateAt('## Title', 'Title').blockType).toBe('h2');
    expect(stateAt('###### Deep', 'Deep').blockType).toBe('h6');
    expect(stateAt('Title\n=====', 'Title').blockType).toBe('h1');
  });

  it('classifies quotes, callouts and code blocks', () => {
    expect(stateAt('> quoted text', 'quoted').blockType).toBe('quote');
    expect(stateAt('> [!note]\n> the body', 'body').blockType).toBe('callout');
    expect(stateAt('```\nconst x = 1\n```', 'x =').blockType).toBe('code');
  });

  it('lets an enclosing quote win over an inner heading (WYSIWYG parity)', () => {
    expect(stateAt('> ## Inside', 'Inside').blockType).toBe('quote');
  });

  it('detects list contexts', () => {
    const bullet = stateAt('- item one', 'item');
    expect(bullet.bulletList).toBe(true);
    expect(bullet.taskList).toBe(false);

    expect(stateAt('1. first', 'first').orderedList).toBe(true);

    const task = stateAt('- [ ] buy milk', 'milk');
    expect(task.taskList).toBe(true);
    expect(task.bulletList).toBe(true);
  });

  it('detects tables', () => {
    const doc = '| a | b |\n| --- | --- |\n| cc | dd |';
    expect(stateAt(doc, 'cc').inTable).toBe(true);
    expect(stateAt('plain text', 'plain').inTable).toBe(false);
  });

  it('reports "other" on an empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [markdown({ base: markdownLanguage })],
    });
    expect(computeRawSelectionState(state).blockType).toBe('other');
  });
});
