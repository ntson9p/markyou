import { parse as parseYaml } from 'yaml';

/**
 * Frontmatter handling at the store boundary (plan §1.2, FR-5.12, FR-10.4).
 *
 * The split is byte-faithful: `rawBlock + body === fullText` always holds, so
 * raw mode (which edits the full text) can round-trip without loss.
 */
export interface FrontmatterState {
  /** The verbatim frontmatter block including both `---` fences and the trailing newline. `null` when absent. */
  rawBlock: string | null;
  /** Parsed YAML mapping; `null` when absent or invalid. */
  data: Record<string, unknown> | null;
  /** False when the YAML failed to parse or is not a mapping (FR-10.4 fallback). */
  valid: boolean;
  error: string | null;
}

export const EMPTY_FRONTMATTER: FrontmatterState = {
  rawBlock: null,
  data: null,
  valid: true,
  error: null,
};

/**
 * Split a leading YAML frontmatter block off the full text.
 * Mirrors micromark-extension-frontmatter semantics (the shared grammar's
 * `remark-frontmatter` handling): the document must *start* with `---` on its
 * own line, closed by a `---` line. An unclosed fence is not frontmatter.
 */
export function splitFrontmatter(fullText: string): { block: string | null; body: string } {
  const openMatch = /^---[ \t]*(\r?\n)/.exec(fullText);
  if (!openMatch) return { block: null, body: fullText };

  // Find the closing fence: a line that is exactly `---` (allowing trailing spaces).
  const rest = fullText.slice(openMatch[0].length);
  const closeMatch = /(^|\r?\n)---[ \t]*(\r?\n|$)/.exec(rest);
  if (!closeMatch) return { block: null, body: fullText };

  const closeEnd = openMatch[0].length + closeMatch.index + closeMatch[0].length;
  return { block: fullText.slice(0, closeEnd), body: fullText.slice(closeEnd) };
}

/** Parse the YAML inside a raw frontmatter block (fences included). */
export function parseFrontmatterBlock(block: string): FrontmatterState {
  const inner = block
    .replace(/^---[ \t]*\r?\n/, '')
    .replace(/(^|\r?\n)---[ \t]*(\r?\n)?$/, '$1')
    .replace(/\r?\n$/, '\n');
  try {
    const data = parseYaml(inner);
    if (data === null || data === undefined) {
      return { rawBlock: block, data: {}, valid: true, error: null };
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
      return {
        rawBlock: block,
        data: null,
        valid: false,
        error: 'Frontmatter must be a YAML mapping (key: value pairs).',
      };
    }
    return { rawBlock: block, data: data as Record<string, unknown>, valid: true, error: null };
  } catch (e) {
    return {
      rawBlock: block,
      data: null,
      valid: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function splitAndParse(fullText: string): { frontmatter: FrontmatterState; body: string } {
  const { block, body } = splitFrontmatter(fullText);
  if (block === null) return { frontmatter: EMPTY_FRONTMATTER, body };
  return { frontmatter: parseFrontmatterBlock(block), body };
}

/** Recombine frontmatter block and body into the canonical full text. */
export function mergeFrontmatter(frontmatter: FrontmatterState, body: string): string {
  if (frontmatter.rawBlock === null) return body;
  return frontmatter.rawBlock + body;
}
