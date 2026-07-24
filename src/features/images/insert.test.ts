import { beforeEach, describe, expect, it } from 'vitest';

import { useAssetsStore } from './assets';
import { fileIsImage, imageSrcFromFile } from './insert';

describe('image insertion (FR-8.1, FR-8.3)', () => {
  beforeEach(() => {
    useAssetsStore.getState().setDir(null);
  });

  it('recognises image files by mime type', () => {
    expect(fileIsImage({ type: 'image/png' })).toBe(true);
    expect(fileIsImage({ type: 'image/svg+xml' })).toBe(true);
    expect(fileIsImage({ type: 'text/plain' })).toBe(false);
    expect(fileIsImage({ type: '' })).toBe(false);
  });

  it('embeds as a base64 data URI when no folder is set', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const file = new File([bytes], 'photo.png', { type: 'image/png' });
    const { src, alt } = await imageSrcFromFile(file);
    // btoa('\x01\x02\x03') === 'AQID'
    expect(src).toBe('data:image/png;base64,AQID');
    expect(alt).toBe('photo');
  });

  it('defaults the mime type to png and names untitled blobs "image"', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const { src, alt } = await imageSrcFromFile(blob);
    expect(src).toBe('data:image/png;base64,AQID');
    expect(alt).toBe('image');
  });
});
