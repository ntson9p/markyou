import type { FileBinding } from '@/core/document/store';
import {
  StorageError,
  isAbortError,
  type OpenResult,
  type StorageProvider,
} from '@/core/storage/types';

const MD_FILE_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Markdown',
    accept: {
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt'],
    },
  },
];

export function supportsFsa(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Ensure we hold the given permission on a handle, re-prompting when required
 * (FR-1.5). Returns false when the user denies.
 */
export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: FileSystemPermissionMode,
): Promise<boolean> {
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  return (await handle.requestPermission({ mode })) === 'granted';
}

async function bindingFor(handle: FileSystemFileHandle): Promise<FileBinding> {
  return { kind: 'fsa', name: handle.name, handle, canSaveInPlace: true };
}

async function writeHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}

/** File System Access provider — Tier 1 (Chromium) experience. */
export class FsaStorageProvider implements StorageProvider {
  readonly capabilities = { saveInPlace: true, reopenHandles: true };

  async open(): Promise<OpenResult | null> {
    let handle: FileSystemFileHandle;
    try {
      [handle] = await window.showOpenFilePicker({ types: MD_FILE_TYPES, multiple: false });
    } catch (e) {
      if (isAbortError(e)) return null;
      throw new StorageError('Could not open the file picker.', e);
    }
    return this.openHandle(handle);
  }

  /** Open a previously persisted handle (recents, drafts, drag-drop). */
  async openHandle(handle: FileSystemFileHandle): Promise<OpenResult> {
    if (!(await ensurePermission(handle, 'read'))) {
      throw new StorageError(`Permission to read “${handle.name}” was denied.`);
    }
    let text: string;
    try {
      const file = await handle.getFile();
      text = await file.text();
    } catch (e) {
      throw new StorageError(`Could not read “${handle.name}”. The file may have moved.`, e);
    }
    return { text, binding: await bindingFor(handle) };
  }

  async save(
    binding: FileBinding | null,
    text: string,
    suggestedName: string,
  ): Promise<FileBinding | null> {
    if (!binding?.handle) return this.saveAs(text, suggestedName);
    if (!(await ensurePermission(binding.handle, 'readwrite'))) {
      throw new StorageError(
        `Permission to write “${binding.name}” was denied. Use Save As to save elsewhere.`,
      );
    }
    try {
      await writeHandle(binding.handle, text);
    } catch (e) {
      throw new StorageError(
        `Saving “${binding.name}” failed. Your draft is still safe locally.`,
        e,
      );
    }
    return binding;
  }

  async saveAs(text: string, suggestedName: string): Promise<FileBinding | null> {
    let handle: FileSystemFileHandle;
    try {
      handle = await window.showSaveFilePicker({
        types: MD_FILE_TYPES,
        suggestedName,
      });
    } catch (e) {
      if (isAbortError(e)) return null;
      throw new StorageError('Could not open the save picker.', e);
    }
    try {
      await writeHandle(handle, text);
    } catch (e) {
      throw new StorageError(
        `Saving “${handle.name}” failed. Your draft is still safe locally.`,
        e,
      );
    }
    return bindingFor(handle);
  }
}
