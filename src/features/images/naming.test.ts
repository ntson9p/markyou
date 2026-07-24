import { describe, expect, it } from 'vitest';

import { assetFileName, extFor, shortHash, slugify } from './naming';

describe('image asset naming (FR-8.2)', () => {
  it('maps known mime types to extensions', () => {
    expect(extFor('image/png')).toBe('png');
    expect(extFor('image/jpeg')).toBe('jpg');
    expect(extFor('image/gif')).toBe('gif');
    expect(extFor('image/webp')).toBe('webp');
    expect(extFor('image/svg+xml')).toBe('svg');
  });

  it('falls back to the file extension, then png', () => {
    expect(extFor('application/octet-stream', 'photo.JPG')).toBe('jpg');
    expect(extFor('application/octet-stream')).toBe('png');
  });

  it('slugifies names to portable ascii-ish stems', () => {
    expect(slugify('My Photo.png')).toBe('my-photo');
    expect(slugify('  Spaces & Symbols!!  .jpg')).toBe('spaces-symbols');
    expect(slugify('.png')).toBe('image');
    expect(slugify('')).toBe('image');
    expect(slugify('a'.repeat(80))).toHaveLength(40);
  });

  it('derives a stable 8-hex short hash from content', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const a = await shortHash(bytes);
    const b = await shortHash(new Uint8Array([1, 2, 3, 4, 5]).buffer);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(a).toBe(b);
    const c = await shortHash(new Uint8Array([9, 9, 9]).buffer);
    expect(c).not.toBe(a);
  });

  it('composes <slug>-<hash>.<ext>', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const name = await assetFileName({ type: 'image/png', name: 'Cat Pic.png' }, bytes);
    expect(name).toMatch(/^cat-pic-[0-9a-f]{8}\.png$/);
  });
});
