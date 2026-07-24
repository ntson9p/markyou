import { useEffect, useRef } from 'react';

import type { Editor } from '@milkdown/kit/core';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';

import { useDocStore } from '@/core/document/store';
import { useSettingsStore } from '@/features/settings/store';

import { createWysiwygEditor } from './create-editor';

/** WYSIWYG → store debounce (plan §2.2). */
const PUSH_DEBOUNCE_MS = 300;

export interface WysiwygEditorProps {
  onEditorReady?: (editor: Editor | null) => void;
  onStateChange?: (state: EditorState) => void;
}

/**
 * The Milkdown adapter (plan §1): mounts the editor on the document body
 * (never the frontmatter, FR-5.12), pushes serialized markdown to the store
 * with origin 'wysiwyg' (debounced 300 ms, flushed on unmount), and applies
 * external store versions via guarded full replace with selection restore.
 * The component is remounted per document (key=docId).
 */
export function WysiwygEditor({ onEditorReady, onStateChange }: WysiwygEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onEditorReady, onStateChange });

  useEffect(() => {
    callbacksRef.current = { onEditorReady, onStateChange };
  }, [onEditorReady, onStateChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let editor: Editor | null = null;
    let disposed = false;

    /** The last body this adapter knows about — the loop-safety anchor. */
    let knownBody = useDocStore.getState().body;

    let pushTimer: number | null = null;
    let pendingBody: string | null = null;

    const flushPush = () => {
      if (pushTimer !== null) {
        window.clearTimeout(pushTimer);
        pushTimer = null;
      }
      if (pendingBody !== null) {
        const body = pendingBody;
        pendingBody = null;
        knownBody = body;
        useDocStore.getState().setBody(body, 'wysiwyg');
      }
    };

    const schedulePush = (markdown: string) => {
      pendingBody = markdown;
      if (pushTimer !== null) window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(flushPush, PUSH_DEBOUNCE_MS);
    };

    void createWysiwygEditor({
      root,
      defaultValue: knownBody,
      stylePrefs: useSettingsStore.getState().markdownStyle,
      onMarkdownUpdated: (markdown) => {
        if (markdown === knownBody) return;
        schedulePush(markdown);
      },
      onStateChange: (state) => callbacksRef.current.onStateChange?.(state),
    }).then((created) => {
      if (disposed) {
        void created.destroy();
        return;
      }
      editor = created;
      callbacksRef.current.onEditorReady?.(created);
    });

    // Store → editor (plan §2.2): guarded full replace on external versions.
    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (!editor) return;
      if (state.version === prev.version) return;
      if (state.origin === 'wysiwyg') return; // origin guard
      if (state.body === knownBody) return; // content-equality short-circuit
      // A pending local push is stale now — external content wins.
      pendingBody = null;
      knownBody = state.body;
      const body = state.body;

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const doc = parser(body);
        const prevSelection = view.state.selection.from;
        let tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
        const pos = Math.min(prevSelection, tr.doc.content.size);
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
        view.dispatch(tr);
      });
    });

    return () => {
      disposed = true;
      unsubscribe();
      flushPush();
      callbacksRef.current.onEditorReady?.(null);
      if (editor) void editor.destroy();
      editor = null;
    };
    // Mounted once per document instance (parent keys this component by docId).
  }, []);

  return (
    <div
      ref={rootRef}
      className="wysiwyg-root md-doc"
      data-testid="wysiwyg-editor"
      aria-label="Document editor"
    />
  );
}
