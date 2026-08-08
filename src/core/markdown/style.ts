/**
 * The single stringify configuration (plan §3.1, D13, FR-13.2). WYSIWYG
 * serialization (Milkdown, M3) reads these options so normalized output style
 * is deterministic and user-configurable. This is the ONLY place serialization
 * style lives.
 */
export interface MarkdownStylePrefs {
  bullet: '-' | '*' | '+';
  emphasis: '*' | '_';
  strong: '*' | '_';
  fence: '`' | '~';
  listItemIndent: 'one' | 'tab';
  rule: '-' | '*' | '_';
  /**
   * Pad table cells so the pipes line up. OFF by default: alignment rewrites
   * every row of every table on any WYSIWYG edit — against the app's
   * "don't touch what the user didn't touch" ethos. Compact output leaves
   * data and header rows of already-compact tables byte-identical (only the
   * delimiter row normalizes — the AST doesn't record dash counts).
   */
  tableAlign: boolean;
}

/** Defaults per FR-13.2: `-` bullets, `*` emphasis, backtick fences. */
export const DEFAULT_STYLE_PREFS: MarkdownStylePrefs = {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  fence: '`',
  listItemIndent: 'one',
  rule: '-',
  tableAlign: false,
};

/**
 * Approximate monospace display width — CJK/fullwidth characters count as 2.
 * Used as the table serializer's `stringLength` when alignment is on, so that
 * columns containing Japanese/Chinese text actually line up in a monospace
 * editor (the default counts code points, misaligning every CJK table).
 */
export function markdownStringWidth(value: string): number {
  let width = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) as number;
    const wide =
      cp >= 0x1100 &&
      (cp <= 0x115f || // Hangul Jamo
        cp === 0x2329 ||
        cp === 0x232a ||
        (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) || // CJK radicals..Yi
        (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
        (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
        (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK compat forms
        (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f) || // emoji (common range)
        (cp >= 0x20000 && cp <= 0x3fffd)); // CJK extensions
    width += wide ? 2 : 1;
  }
  return width;
}

/**
 * remark-gfm serializer options derived from the prefs (table style). These
 * ride the GFM plugin, not remark-stringify — see `remarkGFMPlugin.options`.
 */
export function toGfmOptions(prefs: MarkdownStylePrefs) {
  return prefs.tableAlign
    ? ({ tablePipeAlign: true, stringLength: markdownStringWidth } as const)
    : ({ tablePipeAlign: false } as const);
}

/** remark-stringify options derived from the prefs. */
export function toStringifyOptions(prefs: MarkdownStylePrefs) {
  return {
    bullet: prefs.bullet,
    emphasis: prefs.emphasis,
    strong: prefs.strong,
    fence: prefs.fence,
    fences: true,
    listItemIndent: prefs.listItemIndent,
    rule: prefs.rule,
    resourceLink: false,
    tightDefinitions: true,
  } as const;
}
