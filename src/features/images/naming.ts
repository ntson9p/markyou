/** Asset naming (FR-8.2): `<slug>-<shorthash>.<ext>`, portable beside the doc. */

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

export function extFor(mime: string, fallbackName?: string): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const m = fallbackName?.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : 'png';
}

export function slugify(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'image'
  );
}

/** Short content hash (first 4 bytes of SHA-1) for de-duplication + stable names. */
export async function shortHash(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function assetFileName(
  file: { type: string; name?: string },
  bytes: ArrayBuffer,
): Promise<string> {
  const base = slugify(file.name || 'image');
  const hash = await shortHash(bytes);
  return `${base}-${hash}.${extFor(file.type, file.name)}`;
}
