<!--
Thanks for contributing. Keep this short — a focused PR with a clear "what a user
would notice" line is easier to review than a long description of the code.
-->

## What this changes

<!-- What would a user notice? One or two sentences. -->

## Why

<!--
Link the issue if there is one (`Fixes #123`), and the requirement this serves if you
know it (`FR-5.9`, `D13`). If nothing in docs/requirements.md covers it, say so — that
may mean the spec needs updating too, which is a fine thing for a PR to do.
-->

## How to check it

<!-- The steps a reviewer should take to see it working. -->

## Checklist

- [ ] `npm run typecheck && npm run lint && npm test` pass locally
- [ ] Added or updated a test (a bug fix should have a test that failed before it)
- [ ] Screenshot or clip included, if anything visual changed
- [ ] Round-trip behaviour is unchanged, or a fixture was added to `tests/roundtrip/fixtures/`
- [ ] No new dependency in the initial bundle (heavy things stay behind a dynamic `import()`)
