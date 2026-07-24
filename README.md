# MarkYou

A **local-first, web-based WYSIWYG markdown editor** with three synchronized views of one document:

- **Raw** — CodeMirror 6 source editor with live preview
- **WYSIWYG** — Milkdown rich editor that reads and writes markdown
- **Dual** — both side by side, editing the same document live

Your files stay yours: real `.md` files on disk, no server, no account, fully offline-capable (PWA).

## Specs

The authoritative documents live in [`docs/`](./docs):

- [`docs/requirements.md`](./docs/requirements.md) — requirements, decision log, markdown flavor, budgets, release criteria
- [`docs/implementation-plan.md`](./docs/implementation-plan.md) — architecture, sync protocol, round-trip strategy, milestones M0–M8

## Development

```bash
npm ci            # install (versions pinned via package-lock)
npm run dev       # dev server
npm test          # unit tests (Vitest)
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
to the store through a `SyncController` (origin-tagged, debounced fan-out) — never to each
other. One shared unified/remark pipeline drives the preview, the raw highlighting, and the
WYSIWYG parse/serialize. See the implementation plan for the full picture.
