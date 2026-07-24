import { notify } from '@/app/store/notices';

import { useAssetsStore, writeAsset } from './assets';
import { assetFileName } from './naming';

/** Warn when embedding an image larger than this as base64 (FR-8.3). */
const BASE64_WARN_BYTES = 200 * 1024;

export interface InsertedImage {
  src: string;
  alt: string;
}

export function fileIsImage(file: { type: string }): boolean {
  return typeof file.type === 'string' && file.type.startsWith('image/');
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Turn a pasted/dropped image into a markdown `src` (FR-8.1–8.3): written to
 * the `assets/` folder as a relative link when one is set, otherwise embedded
 * as a base64 data URI with a size warning above 200 KB.
 */
export async function imageSrcFromFile(file: File | Blob, name?: string): Promise<InsertedImage> {
  const rawName = name ?? (file instanceof File ? file.name : '');
  const alt = (rawName || 'image').replace(/\.[^.]+$/, '');
  const bytes = await file.arrayBuffer();
  const type = file.type || 'image/png';

  if (useAssetsStore.getState().dir) {
    try {
      const fileName = await assetFileName({ type, name: rawName || undefined }, bytes);
      await writeAsset(fileName, file);
      return { src: `assets/${fileName}`, alt };
    } catch {
      notify('error', 'Could not write to the images folder — embedding the image inline instead.');
    }
  }

  if (bytes.byteLength > BASE64_WARN_BYTES) {
    notify(
      'info',
      `Embedded a ${Math.round(bytes.byteLength / 1024)} KB image inline. Choose an images folder (Chromium) to keep files small.`,
    );
  }
  return { src: `data:${type};base64,${base64FromBytes(new Uint8Array(bytes))}`, alt };
}
