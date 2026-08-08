import { applyEol, getFullText, useDocStore, type FileBinding } from '@/core/document/store';
import { getStorageProvider } from '@/core/storage/provider';
import { StorageError } from '@/core/storage/types';
import { FsaStorageProvider } from '@/core/storage/fsa';
import { addRecent } from '@/features/files/recents';
import { suggestFileName } from '@/features/files/filename';
import { notify } from '@/app/store/notices';

/**
 * File lifecycle actions (FR-1). Plain functions over the stores so both UI
 * components and keyboard shortcuts can share them.
 */

function confirmDiscardIfDirty(): boolean {
  const state = useDocStore.getState();
  if (state.status !== 'open' || !state.dirty) return true;
  return window.confirm(
    'You have unsaved changes. Open a different document anyway?\n(The current changes remain recoverable as a draft.)',
  );
}

export function newDocument(): void {
  if (!confirmDiscardIfDirty()) return;
  useDocStore.getState().newDocument();
}

export async function openDocument(): Promise<void> {
  if (!confirmDiscardIfDirty()) return;
  const provider = getStorageProvider();
  try {
    const result = await provider.open();
    if (!result) return;
    useDocStore.getState().openDocument({ text: result.text, file: result.binding });
    await addRecent(result.binding);
  } catch (e) {
    notifyError(e, 'Could not open the file.');
  }
}

/** Open a File object (drag-drop or fallback input). */
export function openFromFile(text: string, binding: FileBinding): void {
  useDocStore.getState().openDocument({ text, file: binding });
  void addRecent(binding);
}

/** Open a recents entry (FR-1.5). Falls back to the picker when no handle exists. */
export async function openRecent(handle: FileSystemFileHandle | undefined): Promise<void> {
  if (!confirmDiscardIfDirty()) return;
  if (!handle) {
    notify('info', 'This browser cannot reopen files directly — pick the file again.');
    await openDocument();
    return;
  }
  try {
    const provider = new FsaStorageProvider();
    const result = await provider.openHandle(handle);
    useDocStore.getState().openDocument({ text: result.text, file: result.binding });
    await addRecent(result.binding);
  } catch (e) {
    notifyError(e, 'Could not reopen the file. It may have moved or been deleted.');
  }
}

export async function saveDocument(): Promise<void> {
  const store = useDocStore.getState();
  if (store.status !== 'open') return;
  const provider = getStorageProvider();
  // The store is LF-canonical; write the file back in its own EOL flavor.
  const text = applyEol(getFullText(store), store.eol);
  try {
    const binding = await provider.save(store.file, text, suggestFileName(store));
    if (!binding) return; // user cancelled the picker
    useDocStore.getState().markSaved(binding);
    if (binding.kind === 'fsa') await addRecent(binding);
    if (!binding.canSaveInPlace) {
      notify(
        'info',
        'Saved a copy to your downloads. This browser cannot write files in place — use Chrome or Edge for in-place saving.',
      );
    }
  } catch (e) {
    notifyError(e, 'Saving failed. Your changes are still guarded as a local draft.');
  }
}

export async function saveDocumentAs(): Promise<void> {
  const store = useDocStore.getState();
  if (store.status !== 'open') return;
  const provider = getStorageProvider();
  const text = applyEol(getFullText(store), store.eol);
  try {
    const binding = await provider.saveAs(text, suggestFileName(store));
    if (!binding) return;
    useDocStore.getState().markSaved(binding);
    if (binding.kind === 'fsa') await addRecent(binding);
    if (!binding.canSaveInPlace) {
      notify('info', 'Saved a copy to your downloads.');
    }
  } catch (e) {
    notifyError(e, 'Saving failed. Your changes are still guarded as a local draft.');
  }
}

function notifyError(e: unknown, fallback: string) {
  if (e instanceof StorageError) notify('error', e.message);
  else notify('error', fallback);
  console.error(e);
}
