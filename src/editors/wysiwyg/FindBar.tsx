import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CaseSensitive, Replace, X } from 'lucide-react';

import type { Editor } from '@milkdown/kit/core';
import { editorViewCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';

import { cn } from '@/lib/utils';

import {
  closeFind,
  findNext,
  findPrev,
  getFindState,
  replaceAll,
  replaceCurrent,
  setFindQuery,
} from './plugins/find';

/**
 * Ctrl+F / Ctrl+H shortcut manager for the WYSIWYG pane (FR-9.1/9.2). Capture
 * phase so it can win before other handlers; `shouldHandle` lets dual mode
 * defer to CodeMirror's own search when the source pane is focused.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWysiwygFind(shouldHandle: () => boolean) {
  const shouldHandleRef = useRef(shouldHandle);
  useEffect(() => {
    shouldHandleRef.current = shouldHandle;
  });
  const [open, setOpen] = useState(false);
  const [withReplace, setWithReplace] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== 'f' && k !== 'h') return;
      if (!shouldHandleRef.current()) return;
      e.preventDefault();
      setOpen(true);
      setWithReplace(k === 'h');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return { open, withReplace, close: useCallback(() => setOpen(false), []) };
}

interface FindBarProps {
  editor: Editor;
  initialReplace: boolean;
  onClose: () => void;
}

export function FindBar({ editor, initialReplace, onClose }: FindBarProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [showReplace, setShowReplace] = useState(initialReplace);
  const [count, setCount] = useState({ total: 0, active: -1 });
  const inputRef = useRef<HTMLInputElement>(null);

  const view = useMemo<EditorView | null>(() => {
    let v: EditorView | null = null;
    editor.action((ctx) => {
      v = ctx.get(editorViewCtx);
    });
    return v;
  }, [editor]);

  const refresh = useCallback(() => {
    if (!view) return;
    const fs = getFindState(view);
    setCount({ total: fs.matches.length, active: fs.active });
  }, [view]);

  // Focus on open; clear match decorations on close.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      if (view) closeFind(view);
    };
  }, [view]);

  const act = (fn: (v: EditorView) => void) => {
    if (!view) return;
    fn(view);
    refresh();
  };

  // Apply the search from event handlers (not an effect) so state stays in sync
  // with the editor without cascading renders.
  const applyQuery = (nextQuery: string, nextCase: boolean) => {
    setQuery(nextQuery);
    setCaseSensitive(nextCase);
    act((v) => setFindQuery(v, nextQuery, nextCase));
  };

  const label =
    count.total > 0 ? `${count.active + 1} of ${count.total}` : query ? 'No results' : '';

  return (
    <div
      className="flex flex-col gap-1 border-b border-border bg-background px-2 py-1.5 text-sm"
      role="search"
      aria-label="Find and replace"
      data-testid="wysiwyg-find-bar"
    >
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => applyQuery(e.target.value, caseSensitive)}
          placeholder="Find"
          aria-label="Find"
          data-testid="wysiwyg-find-input"
          className="w-44 rounded border border-input bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              act(e.shiftKey ? findPrev : findNext);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <span
          className="min-w-16 px-1 text-xs text-muted-foreground"
          data-testid="wysiwyg-find-count"
          aria-live="polite"
        >
          {label}
        </span>
        <FindButton label="Previous match" onClick={() => act(findPrev)}>
          <ArrowUp className="size-4" />
        </FindButton>
        <FindButton label="Next match" onClick={() => act(findNext)}>
          <ArrowDown className="size-4" />
        </FindButton>
        <FindButton
          label="Match case"
          active={caseSensitive}
          onClick={() => applyQuery(query, !caseSensitive)}
        >
          <CaseSensitive className="size-4" />
        </FindButton>
        <FindButton
          label="Toggle replace"
          active={showReplace}
          onClick={() => setShowReplace((v) => !v)}
        >
          <Replace className="size-4" />
        </FindButton>
        <span className="flex-1" />
        <FindButton label="Close find" onClick={onClose}>
          <X className="size-4" />
        </FindButton>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace"
            aria-label="Replace with"
            data-testid="wysiwyg-replace-input"
            className="w-44 rounded border border-input bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          <button
            type="button"
            onClick={() => act((v) => replaceCurrent(v, replacement))}
            data-testid="wysiwyg-replace"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => act((v) => replaceAll(v, replacement))}
            data-testid="wysiwyg-replace-all"
            className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

function FindButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded hover:bg-accent hover:text-accent-foreground',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}
