# MarkYou WYSIWYG UX findings (in progress)

## Confirmed issues

1. **Inconsistent list-nesting vertical spacing.** When a list item indents into
   a new nested sub-list, the gap above the first nested item is 12px, but the
   gap between sibling items at the same level is only 4px, and outdenting back
   to a shallower level does not restore any extra spacing (also 4px). This 3x
   inconsistency makes nested lists look uneven/bug-like rather than
   intentional visual grouping. (Measured precisely via getBoundingClientRect;
   screenshot: 06-bullet-list-fresh.png)

2. **Backspace on a solo list item needs two presses, not one.** Create a list
   with exactly one item ("- only item"), put the caret at the very start, and
   press Backspace: nothing happens (no-op). A second Backspace is required to
   dissolve it into a plain paragraph. By contrast, Backspace at the start of
   the *first item of a multi-item list* dissolves that item into a paragraph
   in a single press (verified: "- first / second" → Backspace at start of
   "first" → immediately becomes `<p>first</p>` + a one-item list "second").
   This inconsistency means the single most common "oops, undo this bullet"
   gesture (type "- ", immediately Backspace) silently fails on the first try.
   (Screenshots: 16-backspace-solo-item.png, 15-backspace-first-item.png)

3. **Callout title text is oddly offset from its icon in the WYSIWYG editor**
   (not in the read-only preview). `.wysiwyg-root .callout-title` (wysiwyg.css
   line ~225) sets `justify-content: space-between` on a row with 3 flex
   items — the icon (`::before`), the title text (`.callout-title-text`), and
   the type picker (`<select class="callout-picker">`, invisible via
   `opacity: 0` until hover but still occupying layout width). With 3 items
   and space-between, the title text lands roughly centered in the remaining
   space instead of sitting flush next to the icon. Measured: title text sits
   ~198px from the row's left edge on a 503px-wide row, with an 87.6px
   invisible picker still claiming space on the right. The preview
   (`.md-doc .callout-title`, no justify-content override, just `gap`)
   renders this correctly — icon and title flush together on the left. Fix
   direction: push only the picker right (e.g. `margin-left: auto` on
   `.callout-picker`) instead of `justify-content: space-between` on the row.
   (Screenshot: 21b-callout.png)

4. **[HIGH] Tab inside a code block ejects focus from the editor entirely,
   instead of indenting.** Click into a code block's CodeMirror content, type
   text, press Tab: `document.activeElement` goes from `.cm-content` to
   nothing (focus lands on `<body>`), no indent/tab character is inserted, and
   all further keystrokes are silently swallowed until the user clicks back
   into the block. Verified precisely via `document.activeElement.className`
   before/after Tab, and by confirming a post-Tab keystroke never reaches the
   code content. Every plain-text/code editor convention (and CodeMirror's own
   defaults, when wired up) treats Tab as "indent the current line," not
   "leave the editor" — this will trip up virtually anyone writing
   indented code in a WYSIWYG code block. Likely missing an
   `indentWithTab`-style keymap on the code block's CodeMirror instance.
   (Screenshots: 23a/23b-code-block*.png, 24-codeblock-tab.png)

5. **[HIGH] No working way to add content after a trailing code block —
   every discoverable path either no-ops or silently retypes into the code.**
   With a code block as the last node in the document:
   - Enter on an empty last line inside the block does **not** exit it (just
     adds another empty code line) — confirmed by dumping the block's own
     content and the toolbar still reading "Code block" afterward.
   - Clicking in the empty space below the block moves
     `document.activeElement` to the outer `ProseMirror` container (not into
     any paragraph — `editor.locator('> p')` finds nothing), and any text
     typed afterward is **silently discarded entirely** — verified the code
     block's content is byte-for-byte unchanged and no paragraph exists
     anywhere in the doc after typing.
   - The block-handle's own "+" ("insert block below") button *does* insert a
     real empty `<p>` right after the code block in the document — but focus
     never moves there. `document.activeElement` is still `cm-content`
     immediately after the click, so the next keystrokes land back inside the
     code fence (e.g. typing "AAA" produces `const x = 1;AAA` inside the code
     block, while the new paragraph stays permanently empty).
   Net effect: a user who writes a code block as their last piece of content
   and then wants to add a closing paragraph has no reliable way to do it —
   every button/keystroke a reasonable person would try either does nothing
   or quietly writes into the wrong place. (Screenshots:
   25-codeblock-exit.png, 26/27-codeblock-click-below*.png,
   30-codeblock-plus-v2.png)

6. **[MEDIUM] Enter in the first cell of a table jumps all the way past the
   entire table**, not just out of the current row. With a fresh 3x3 table,
   clicking the top-left header cell, typing "line one", then pressing Enter:
   focus leaves the table completely and a new paragraph is created *after
   the last row* — verified via document structure dump (table block still
   has 3 rows, unchanged, and a new empty `<p>` appears as the table's next
   sibling). Typing "line two" afterward lands in that trailing paragraph,
   visually far below the still-empty remaining cells. Markdown table cells
   can't hold a real line break, so exiting the table on Enter is defensible,
   but skipping over two untouched rows to land below the whole table (rather
   than, say, moving to the cell directly below, à la spreadsheet Enter
   behavior) is easy to not notice — the two blank rows stay sitting there
   and the user's next line of text is now decoupled from the table with no
   visual cue that a jump happened. (Screenshot: 34-table-enter-trace.png)

7. **[LOW, discoverability only] "Add row" lives on a separate, easy-to-miss
   affordance from "Delete row".** Hovering a row and clicking its
   row-drag-handle (the grip on the left) only offers "Delete row" — no add
   action there. Add row/column *does* exist, but only appears as a thin line
   handle when hovering the exact boundary *between* two rows/columns
   (confirmed: hovering a row's bottom edge reveals `[data-role="x-line-drag-
   handle"]` with an "Add row" button; clicking it took the table from 3 rows
   to 4). Since the delete action and the add action live on two differently
   -triggered, spatially separate handles, a user who finds "Delete row" via
   the obvious grip handle may not discover that adding a row requires
   hovering a precise 1px boundary line instead. Not a functional bug — a
   minor discoverability gap.

8. **[HIGH] Block math input rule never fires — `$$` + space does nothing,
   even though it's implemented in source.** `src/editors/wysiwyg/input-
   rules.ts` defines `mathBlockInputRule` with regex `/^\$\$\s$/` ("typing
   `$$` then space on an empty line creates a math block", per its own
   comment). Live-tested by pressing `$`, `$`, then Space key-by-key and
   checking DOM state after each keystroke: the text "$$ " is inserted
   literally and stays literal text — `[data-type="math-block"]` count is 0.
   Reproduced in the first paragraph of a fresh doc and in a second paragraph
   after other content (ruling out a first-block special case). By contrast,
   its sibling rules in the very same `wysiwygInputRules` array both work
   correctly when tested the same way: `mathInlineInputRule` (`$e^{i\pi}+1=0$`
   → renders as KaTeX immediately) and `calloutInputRule` (`> [!note] ` →
   renders as a styled callout), so this isn't a registration problem with
   the whole rule set — something specific to the block-math rule (or a
   higher-priority rule elsewhere consuming the same keystroke first) is
   swallowing the match. Note: block math loaded *from an existing file*
   (parseMarkdown path) still renders fine — this is specifically the
   live-typing input rule that's broken, which is why the project's own
   e2e suite (which seeds pre-written markdown rather than typing "$$ " live)
   never caught it. (Screenshot: 40a-block-math-created.png)

9. **[LOW] A live-typed mermaid fence stays a plain code block until a mode
   round-trip re-parses it — it doesn't render as a diagram on its own.**
   Typing ` ```mermaid ` + diagram source creates a normal syntax-highlighted
   code block (language tag "mermaid"), and it stays that way even after
   blurring/clicking elsewhere. Switching to Raw mode and back to WYSIWYG
   (forcing a markdown round-trip) does correctly render it as a `.diagram-
   node` with a live SVG — so the parser/renderer both work fine; only the
   "render live as you type" step is missing. Likely intentional (keeps the
   block a live source editor while you're actively typing it, same as any
   other code block), but users accustomed to Obsidian-style live diagram
   preview may expect it to render sooner. Low priority.

10. **~~[MEDIUM] Inserting an image via the toolbar makes it overlap the
    adjacent paragraph text.~~ RETRACTED — not a bug; the original measurement
    was wrong.** The claim was that a toolbar-inserted 200x100 image "visually
    overlaps upward over the text". Re-measured properly and it does not: the
    original check compared the image's rect against the *paragraph element's*
    rect, and since the paragraph contains the image those always intersect, so
    the test could only ever report an overlap. Measuring the text glyphs
    instead (a DOM Range over the paragraph's text nodes) gives

        img:  top 199  bottom 299  left 621.97  right 821.97
        text: top 282  bottom 303  left 370.50  right 621.97
        overlaps: false

    The edges abut exactly at 621.97 and the paragraph's line box grows from
    ~21px to 136px to accommodate the image — textbook `inline-block` layout,
    confirmed visually too (shots 80a/80b). What remains is a design
    preference, not a defect: "Insert image" places the image inline at the
    caret, which is what `text ![](src)` means in CommonMark. There is no
    block-image node in markdown, so rendering a lone image as a block would
    make one paragraph *look* like two. Left as is deliberately.

## Notes / non-issues (test harness artifacts, not app bugs)

- Switching mode (WYSIWYG → Raw) immediately after typing, with zero wait,
  showed an apparently-empty Raw pane. This is because the WYSIWYG → store
  sync is debounced (~400-600ms, matching the app's own test suite which
  explicitly waits before checking synced content); adding that wait made
  Raw mode show the correct text every time. Not re-testing as a real bug —
  requires switching modes within under ~400ms of the last keystroke, which
  is at the edge of plausible human speed via mouse click (vs. my
  zero-delay scripted key press).

- Two ordered-list fragments separated by unrelated content (e.g. a task
  list) each restart numbering at 1 instead of continuing — this is correct
  CommonMark behavior for interrupted lists (matches Obsidian/Typora), not a
  bug. Only relevant because my own test script inserted content between two
  list fragments; not a real user-facing issue.

- `window.confirm()` (used by New Document / Open File "discard changes?"
  flows) is not reliably automatable through the connectOverCDP reconnect
  session used for this testing session — a Playwright-internal auto-dismiss
  races the explicit dialog listener. Confirmed by reading actions.ts: the
  confirm flow and message text are implemented correctly
  (`confirmDiscardIfDirty` in src/features/files/actions.ts). Not re-tested
  live end-to-end; treat as code-reviewed but not click-tested.
