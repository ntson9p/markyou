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
}

/** Defaults per FR-13.2: `-` bullets, `*` emphasis, backtick fences. */
export const DEFAULT_STYLE_PREFS: MarkdownStylePrefs = {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  fence: '`',
  listItemIndent: 'one',
  rule: '-',
};

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
