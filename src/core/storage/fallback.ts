import type { FileBinding } from '@/core/document/store';
import { type OpenResult, type StorageProvider } from '@/core/storage/types';

/**
 * Fallback provider for browsers without the File System Access API
 * (Firefox/Safari, Tier 2): open via file input, save via download
 * ("Save a copy", FR-1.3).
 */
export class FallbackStorageProvider implements StorageProvider {
  readonly capabilities = { saveInPlace: false, reopenHandles: false };

  open(): Promise<OpenResult | null> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt,text/markdown,text/plain';
      input.style.display = 'none';
      document.body.appendChild(input);

      const cleanup = () => {
        input.remove();
        window.removeEventListener('focus', onFocusBack);
      };
      // Detect picker cancellation: focus returns without a change event.
      const onFocusBack = () => {
        setTimeout(() => {
          if (input.files?.length === 0 || !input.files) {
            cleanup();
            resolve(null);
          }
        }, 500);
      };

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        try {
          resolve({ text: await file.text(), binding: bindingForName(file.name) });
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      });
      window.addEventListener('focus', onFocusBack, { once: true });
      input.click();
    });
  }

  async save(
    _binding: FileBinding | null,
    text: string,
    suggestedName: string,
  ): Promise<FileBinding | null> {
    return this.saveAs(text, suggestedName);
  }

  async saveAs(text: string, suggestedName: string): Promise<FileBinding | null> {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    return bindingForName(suggestedName);
  }
}

function bindingForName(name: string): FileBinding {
  return { kind: 'memory', name, canSaveInPlace: false };
}
