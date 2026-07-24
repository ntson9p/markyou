import { EditorView } from '@codemirror/view';

import { fileIsImage, imageSrcFromFile } from '@/features/images/insert';

/** Insert markdown image links at the cursor for each dropped/pasted image. */
async function insertImages(view: EditorView, files: File[]): Promise<void> {
  for (const file of files) {
    const { src, alt } = await imageSrcFromFile(file);
    const md = `![${alt}](${src})`;
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, insert: md },
      selection: { anchor: pos + md.length },
    });
  }
}

/** Paste/drop images into the raw pane (FR-8.1). */
export const imagePasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    const files = Array.from(event.clipboardData?.files ?? []).filter(fileIsImage);
    if (files.length === 0) return false;
    event.preventDefault();
    void insertImages(view, files);
    return true;
  },
  drop(event, view) {
    const files = Array.from(event.dataTransfer?.files ?? []).filter(fileIsImage);
    if (files.length === 0) return false;
    event.preventDefault();
    event.stopPropagation(); // don't let the app's .md drop handler also fire
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos != null) view.dispatch({ selection: { anchor: pos } });
    void insertImages(view, files);
    return true;
  },
});
