# MarkYou

A **local-first, web-based WYSIWYG markdown editor** with three synchronized views of one document:

- **Raw** — CodeMirror 6 source editor with live, scroll-synced preview
- **WYSIWYG** — Milkdown rich editor that reads and writes markdown
- **Dual** — both side by side, editing the same document live

Your files stay yours: real `.md` files on disk, no server, no account, fully offline-capable (PWA).

## Features

- **Three modes** (`Ctrl+Shift+1/2/3`) over one canonical document — switch any time.
- **One grammar everywhere:** a single unified/remark pipeline parses and serializes for
  every mode, so raw-mode edits are byte-faithful — the app never rewrites text you didn't touch.
- **GitHub-Flavored Markdown** plus tables, task lists, footnotes, callouts, KaTeX math, and
  Mermaid diagrams.
- **WYSIWYG editing** with a selection bubble menu, `/` slash commands, block drag handles,
  and rich↔markdown copy/paste.
- **No data loss:** continuous local drafts guard every keystroke; a recovery banner restores
  your work after a crash or tab close. Save in place on Chromium; "save a copy" elsewhere.
- **Images:** paste or drop into either editor — written to an `assets/` folder as relative
  links (Chromium) or embedded as base64 with a size warning.
- **Find & replace, outline, live word/character counts, a frontmatter metadata editor,
  local version snapshots** with diffs and restore, and **export** to standalone HTML,
  print/PDF, or rich-text clipboard.
- **Responsive & accessible:** single-pane on phones/tablets, a keyboard-operable toolbar,
  WCAG 2.1 AA contrast in light and dark themes, and `prefers-reduced-motion` support.

Press `Ctrl+/` (or menu → **Keyboard shortcuts**) for the full shortcut list.

## Browser support

| Tier | Browsers | Experience |
|---|---|---|
| 1 | Chrome, Edge (desktop) | Everything, incl. in-place save and `assets/` images |
| 2 | Firefox, Safari (desktop) | Full editing; open / "save a copy"; base64 image fallback |
| 3 | iOS Safari, Android Chrome | Responsive single pane; touch formatting via the bubble menu; dual mode unavailable |

## Specs

The authoritative documents live in [`docs/`](./docs):

- [`docs/requirements.md`](./docs/requirements.md) — requirements, decision log, markdown flavor, budgets, release criteria
- [`docs/implementation-plan.md`](./docs/implementation-plan.md) — architecture, sync protocol, round-trip strategy, milestones M0–M8

## Development

```bash
npm ci            # install (versions pinned via package-lock)
npm run dev       # dev server
npm test          # unit tests (Vitest)
npm run e2e       # end-to-end tests (Playwright, Chromium + Firefox)
npm run typecheck # TypeScript strict
npm run lint      # ESLint
npm run build     # production build
npm run bundle-size  # enforce the initial-JS budget (≤ 350 KB gz)
npm run icons     # regenerate PWA icons (scripts/generate-icons.mjs)
```

## Commit conventions

Conventional-commit style prefixes, scoped by milestone/feature, e.g.:

```
feat(m0): app shell with mode switcher and theme toggle
fix(sync): guard echo loop on wysiwyg replace
test(roundtrip): add gfm table fixtures
```

## Architecture (short version)

One canonical markdown string lives in the `DocumentStore`. Editors are adapters that talk
to the store through the sync protocol (origin-tagged, debounced fan-out) — never to each
other. One shared unified/remark pipeline drives the preview, the raw highlighting, and the
WYSIWYG parse/serialize. See the implementation plan for the full picture.

## Privacy

No telemetry, no accounts, no network calls required for any core function. The app is fully
client-side; documents only reach the network if they reference remote image URLs you added.
