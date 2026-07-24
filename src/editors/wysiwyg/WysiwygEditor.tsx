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
/** store → WYSIWYG replace debounce (plan §2.2): coalesces rapid raw typing. */
const REPLACE_DEBOUNCE_MS = 300;

export interface WysiwygEditorProps {
  onEditorReady?: (editor: Editor | null) => void;
  onStateChange?: (state: EditorState) => void;
  /**
   * FR-6.4 failure isolation: fired with a message when the body cannot be
   * parsed into the editor, and with `null` once it parses again.
   */
  onParseError?: (message: string | null) => void;
}

/**
 * The Milkdown adapter (plan §1): mounts the editor on the document body
 * (never the frontmatter, FR-5.12), pushes serialized markdown to the store
 * with origin 'wysiwyg' (debounced 300 ms, flushed on unmount), and applies
 * external store versions (plan §2.2 store→WYSIWYG):
 *
 * - debounced 300 ms so rapid raw-pane typing coalesces into one replace;
 * - deferred while this pane is focused (the user edits one pane at a time —
 *   applied on blur), so an in-progress edit is never yanked out;
 * - dispatched with `addToHistory: false`, which mutes Milkdown's
 *   markdownUpdated listener (no echo push — a raw edit must not reformat
 *   untouched text, FR-6.2) and keeps sync off the undo stack (FR-5.14);
 * - wrapped in try/catch so a body the editor can't parse isolates to a pane
 *   banner instead of corrupting the store (FR-6.4).
 *
 * The component is remounted per document (key=docId).
 */
export function WysiwygEditor({ onEditorReady, onStateChange, onParseError }: WysiwygEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onEditorReady, onStateChange, onParseError });

  useEffect(() => {
    callbacksRef.current = { onEditorReady, onStateChange, onParseError };
  }, [onEditorReady, onStateChange, onParseError]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let editor: Editor | null = null;
    let disposed = false;

    /** The last body this adapter knows about — the loop-safety anchor. */
    let knownBody = useDocStore.getState().body;

    // ---- WYSIWYG → store (debounced push) ----
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

    // ---- store → WYSIWYG (debounced, deferred, isolated replace) ----
    let replaceTimer: number | null = null;
    let deferred = false;

    const applyExternal = () => {
      replaceTimer = null;
      if (!editor || disposed) return;
      const s = useDocStore.getState();
      if (s.origin === 'wysiwyg' || s.body === knownBody) return;

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        // Defer while the user is actively editing this pane; apply on blur.
        if (view.hasFocus()) {
          deferred = true;
          return;
        }
        const body = s.body;
        try {
          const parser = ctx.get(parserCtx);
          const doc = parser(body);
          if (!doc) throw new Error('Parser returned no document');
          const prevFrom = view.state.selection.from;
          let tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
          const pos = Math.min(prevFrom, tr.doc.content.size);
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
          tr = tr.setMeta('addToHistory', false);
          view.dispatch(tr);
          knownBody = body;
          pendingBody = null;
          deferred = false;
          callbacksRef.current.onParseError?.(null);
        } catch (err) {
          callbacksRef.current.onParseError?.(
            err instanceof Error ? err.message : 'This document could not be rendered.',
          );
        }
      });
    };

    const scheduleReplace = () => {
      if (replaceTimer !== null) window.clearTimeout(replaceTimer);
      replaceTimer = window.setTimeout(applyExternal, REPLACE_DEBOUNCE_MS);
    };

    let detachBlur: (() => void) | null = null;

    void createWysiwygEditor({
      root,
      defaultValue: knownBody,
      stylePrefs: useSettingsStore.getState().markdownStyle,
      onMarkdownUpdated: (markdown) => {
        if (markdown === knownBody) return;
        schedulePush(markdown);
      },
      onStateChange: (state) => callbacksRef.current.onStateChange?.(state),
    })
      .then((created) => {
        if (disposed) {
          void created.destroy();
          return;
        }
        editor = created;
        // Flush a deferred external replace once the user leaves this pane.
        created.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const onBlur = () => {
            if (deferred) applyExternal();
          };
          view.dom.addEventListener('blur', onBlur);
          detachBlur = () => view.dom.removeEventListener('blur', onBlur);
        });
        callbacksRef.current.onEditorReady?.(created);
      })
      .catch((err) => {
        // Initial parse of pathological input failed — isolate (FR-6.4).
        callbacksRef.current.onParseError?.(
          err instanceof Error ? err.message : 'This document could not be rendered.',
        );
      });

    // Store → editor: guarded schedule on any external version (plan §2.2).
    const unsubscribe = useDocStore.subscribe((state, prev) => {
      if (!editor) return;
      if (state.version === prev.version) return; // version guard
      if (state.origin === 'wysiwyg') return; // origin guard
      if (state.body === knownBody) return; // content-equality short-circuit
      pendingBody = null; // a pending local push is stale — external wins
      scheduleReplace();
    });

    return () => {
      disposed = true;
      unsubscribe();
      if (replaceTimer !== null) window.clearTimeout(replaceTimer);
      detachBlur?.();
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
