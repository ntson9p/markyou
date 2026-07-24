import { useEffect } from 'react';

import type { FileBinding } from '@/core/document/store';
import { useDocStore } from '@/core/document/store';
import { openFromFile } from '@/features/files/actions';
import { notify } from '@/app/store/notices';

const MD_EXTENSIONS = /\.(md|markdown|txt)$/i;

/** Drag-and-drop an .md file anywhere on the app opens it (FR-1.8). */
export function useFileDrop() {
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };

    const onDrop = async (e: DragEvent) => {
      const item = e.dataTransfer?.items?.[0];
      if (!item || item.kind !== 'file') return;
      e.preventDefault();

      const state = useDocStore.getState();
      if (
        state.status === 'open' &&
        state.dirty &&
        !window.confirm(
          'You have unsaved changes. Open the dropped file anyway?\n(The current changes remain recoverable as a draft.)',
        )
      ) {
        return;
      }

      try {
        // Chromium: get a real handle so in-place save works for dropped files too.
        const withHandle = item as DataTransferItem & {
          getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
        };
        if (typeof withHandle.getAsFileSystemHandle === 'function') {
          const handle = await withHandle.getAsFileSystemHandle();
          if (handle?.kind === 'file') {
            const fileHandle = handle as FileSystemFileHandle;
            if (!MD_EXTENSIONS.test(fileHandle.name)) {
              notify('info', 'Only .md, .markdown and .txt files can be opened.');
              return;
            }
            const file = await fileHandle.getFile();
            const binding: FileBinding = {
              kind: 'fsa',
              name: fileHandle.name,
              handle: fileHandle,
              canSaveInPlace: true,
            };
            openFromFile(await file.text(), binding);
            return;
          }
        }

        const file = item.getAsFile();
        if (!file) return;
        if (!MD_EXTENSIONS.test(file.name)) {
          notify('info', 'Only .md, .markdown and .txt files can be opened.');
          return;
        }
        const binding: FileBinding = { kind: 'memory', name: file.name, canSaveInPlace: false };
        openFromFile(await file.text(), binding);
      } catch (err) {
        notify('error', 'Could not open the dropped file.');
        console.error(err);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);
}
