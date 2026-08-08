import { create } from 'zustand';

import {
  EMPTY_FRONTMATTER,
  mergeFrontmatter,
  parseFrontmatterBlock,
  splitAndParse,
  type FrontmatterState,
} from '@/core/document/frontmatter';

/** Author of a document version (plan §2.1). 'diff' is the Review Changes editor. */
export type Origin = 'raw' | 'wysiwyg' | 'meta' | 'system' | 'diff';

/** Line-ending flavor of the underlying file. */
export type Eol = 'lf' | 'crlf';

/**
 * The store's text is LF-canonical. CodeMirror normalizes line breaks the
 * moment a document is created, and remark serializes with \n — so a CRLF
 * file's text inevitably becomes LF after the first edit anyway. Normalizing
 * once at the store boundary makes that explicit and keeps every comparison
 * against `savedText` truthful (Review Changes, recovery diff, dirty checks).
 * The file's original flavor is kept in `eol` and re-applied on save, so a
 * CRLF file stays CRLF on disk (D13 spirit: don't rewrite what wasn't edited).
 */
export function normalizeEol(text: string): string {
  return text.includes('\r') ? text.replace(/\r\n?/g, '\n') : text;
}

export function detectEol(text: string): Eol {
  return text.includes('\r\n') ? 'crlf' : 'lf';
}

/** Re-apply the file's EOL flavor for disk writes (input must be LF-canonical). */
export function applyEol(text: string, eol: Eol): string {
  return eol === 'crlf' ? text.replace(/\n/g, '\r\n') : text;
}

/** How the document is bound to a real file. */
export interface FileBinding {
  /** 'fsa' — File System Access handle (Tier 1); 'memory' — no in-place save (Tier 2/3). */
  kind: 'fsa' | 'memory';
  name: string;
  handle?: FileSystemFileHandle;
  /** True when Ctrl+S can write the original file in place (FR-1.3). */
  canSaveInPlace: boolean;
}

export interface DocState {
  /** Whether a document is open (vs. the welcome screen). */
  status: 'welcome' | 'open';
  /** Stable id for drafts/snapshots keying. Regenerated per opened document. */
  docId: string;
  /** Canonical markdown body — no frontmatter (plan §1.2). */
  body: string;
  frontmatter: FrontmatterState;
  /** Monotonically increasing version, bumped on every content change. */
  version: number;
  /** Author of the current version. */
  origin: Origin;
  dirty: boolean;
  file: FileBinding | null;
  lastSavedAt: number | null;
  /**
   * Full text at the last save/open — the base for recovery and Review Changes
   * diffs. Null for never-saved docs. LF-canonical, like all store text.
   */
  savedText: string | null;
  /** The file's line-ending flavor, re-applied on save. */
  eol: Eol;

  // Actions
  newDocument: () => void;
  openDocument: (args: {
    text: string;
    file: FileBinding | null;
    dirty?: boolean;
    docId?: string;
    savedText?: string | null;
  }) => void;
  closeDocument: () => void;
  /** Raw mode pushes the FULL text (frontmatter included); the store re-splits (plan §2.2). */
  setFullText: (text: string, origin: Origin) => void;
  /** WYSIWYG pushes only the body; the frontmatter block is untouched. */
  setBody: (body: string, origin: Origin) => void;
  /** Metadata panel writes a new frontmatter block ('' removes it). */
  setFrontmatterBlock: (block: string | null, origin?: Origin) => void;
  /** Replace the whole document with a version snapshot (FR-12.3); marks dirty. */
  restoreText: (text: string) => void;
  markSaved: (file: FileBinding) => void;
}

/** Derive the canonical full text (frontmatter + body) from a state snapshot. */
export function getFullText(state: Pick<DocState, 'body' | 'frontmatter'>): string {
  return mergeFrontmatter(state.frontmatter, state.body);
}

function newDocId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useDocStore = create<DocState>()((set, get) => ({
  status: 'welcome',
  docId: '',
  body: '',
  frontmatter: EMPTY_FRONTMATTER,
  version: 0,
  origin: 'system',
  dirty: false,
  file: null,
  lastSavedAt: null,
  savedText: null,
  eol: 'lf',

  newDocument: () =>
    set({
      status: 'open',
      docId: newDocId(),
      body: '',
      frontmatter: EMPTY_FRONTMATTER,
      version: 0,
      origin: 'system',
      dirty: false,
      file: null,
      lastSavedAt: null,
      savedText: null,
      eol: 'lf',
    }),

  openDocument: ({ text, file, dirty = false, docId, savedText }) => {
    // LF-canonical store; the flavor is remembered and re-applied on save.
    const eol = detectEol(text);
    const normalized = normalizeEol(text);
    const { frontmatter, body } = splitAndParse(normalized);
    set({
      status: 'open',
      docId: docId ?? newDocId(),
      body,
      frontmatter,
      version: 0,
      origin: 'system',
      dirty,
      file,
      lastSavedAt: null,
      savedText:
        savedText !== undefined
          ? savedText === null
            ? null
            : normalizeEol(savedText)
          : dirty
            ? null
            : normalized,
      eol,
    });
  },

  closeDocument: () =>
    set({
      status: 'welcome',
      docId: '',
      body: '',
      frontmatter: EMPTY_FRONTMATTER,
      version: 0,
      origin: 'system',
      dirty: false,
      file: null,
      lastSavedAt: null,
      savedText: null,
      eol: 'lf',
    }),

  setFullText: (text, origin) => {
    const state = get();
    text = normalizeEol(text); // editors emit LF, but keep the invariant airtight
    if (text === getFullText(state)) return; // content-equality short-circuit
    const { frontmatter, body } = splitAndParse(text);
    set({
      body,
      frontmatter,
      version: state.version + 1,
      origin,
      dirty: origin === 'system' ? state.dirty : true,
    });
  },

  setBody: (body, origin) => {
    const state = get();
    body = normalizeEol(body);
    if (body === state.body) return;
    set({
      body,
      version: state.version + 1,
      origin,
      dirty: origin === 'system' ? state.dirty : true,
    });
  },

  setFrontmatterBlock: (block, origin = 'meta') => {
    const state = get();
    const normalized = block === '' || block === null ? null : normalizeEol(block);
    if (normalized === state.frontmatter.rawBlock) return;
    const frontmatter = normalized === null ? EMPTY_FRONTMATTER : parseFrontmatterBlock(normalized);
    set({
      frontmatter,
      version: state.version + 1,
      origin,
      dirty: true,
    });
  },

  restoreText: (text) => {
    const state = get();
    text = normalizeEol(text); // pre-fix snapshots/drafts may carry CRLF
    if (text === getFullText(state)) return;
    const { frontmatter, body } = splitAndParse(text);
    // origin 'system' so every editor applies it (none authored it); dirty so
    // the restore is savable and draft-guarded.
    set({ body, frontmatter, version: state.version + 1, origin: 'system', dirty: true });
  },

  markSaved: (file) =>
    set((state) => ({
      dirty: false,
      file,
      lastSavedAt: Date.now(),
      savedText: getFullText(state),
    })),
}));
