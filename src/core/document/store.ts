import { create } from 'zustand';

import {
  EMPTY_FRONTMATTER,
  mergeFrontmatter,
  parseFrontmatterBlock,
  splitAndParse,
  type FrontmatterState,
} from '@/core/document/frontmatter';

/** Author of a document version (plan §2.1). */
export type Origin = 'raw' | 'wysiwyg' | 'meta' | 'system';

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
  /** Full text at the last save/open — the base for recovery diffs. Null for never-saved docs. */
  savedText: string | null;

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
    }),

  openDocument: ({ text, file, dirty = false, docId, savedText }) => {
    const { frontmatter, body } = splitAndParse(text);
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
      savedText: savedText !== undefined ? savedText : dirty ? null : text,
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
    }),

  setFullText: (text, origin) => {
    const state = get();
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
    const normalized = block === '' ? null : block;
    if (normalized === state.frontmatter.rawBlock) return;
    const frontmatter = normalized === null ? EMPTY_FRONTMATTER : parseFrontmatterBlock(normalized);
    set({
      frontmatter,
      version: state.version + 1,
      origin,
      dirty: true,
    });
  },

  markSaved: (file) =>
    set((state) => ({
      dirty: false,
      file,
      lastSavedAt: Date.now(),
      savedText: getFullText(state),
    })),
}));
