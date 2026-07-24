import { stringify as stringifyYaml } from 'yaml';

/** Build a full frontmatter block (fences + trailing newline) from a data map. */
export function buildFrontmatterBlock(data: Record<string, unknown>): string | null {
  if (Object.keys(data).length === 0) return null;
  return `---\n${stringifyYaml(data)}---\n`;
}

/** Wrap raw inner YAML text as a frontmatter block ('' → null to remove it). */
export function rawToBlock(text: string): string {
  const trimmed = text.replace(/\s+$/, '');
  return trimmed === '' ? '' : `---\n${trimmed}\n---\n`;
}

/** Best-effort scalar coercion for a text field value. */
export function coerceScalar(text: string): unknown {
  const t = text.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return text;
}

/** True when every value is a scalar we can edit as a plain text field. */
export function allScalar(data: Record<string, unknown>): boolean {
  return Object.values(data).every(
    (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v),
  );
}

/** The inner YAML text of a raw block (fences stripped). */
export function innerYaml(rawBlock: string): string {
  return rawBlock
    .replace(/^---[ \t]*\r?\n/, '')
    .replace(/\r?\n?---[ \t]*\r?\n?$/, '')
    .replace(/\s+$/, '');
}
