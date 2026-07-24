import { commandsCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { insertImageCommand } from '@milkdown/kit/preset/commonmark';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

import { fileIsImage, imageSrcFromFile } from '@/features/images/insert';

/** Paste/drop images into the WYSIWYG pane (FR-8.1). */
async function insertFiles(ctx: Ctx, files: File[]): Promise<void> {
  for (const file of files) {
    const { src, alt } = await imageSrcFromFile(file);
    ctx.get(commandsCtx).call(insertImageCommand.key, { src, alt, title: '' });
  }
}

export const imagePastePlugin = $prose(
  (ctx) =>
    new Plugin({
      props: {
        handlePaste(_view, event) {
          const files = Array.from(event.clipboardData?.files ?? []).filter(fileIsImage);
          if (files.length === 0) return false;
          event.preventDefault();
          void insertFiles(ctx, files);
          return true;
        },
        handleDrop(view, event) {
          const dt = (event as DragEvent).dataTransfer;
          const files = Array.from(dt?.files ?? []).filter(fileIsImage);
          if (files.length === 0) return false;
          event.preventDefault();
          event.stopPropagation(); // don't let the app's .md drop handler also fire
          const coords = view.posAtCoords({
            left: (event as DragEvent).clientX,
            top: (event as DragEvent).clientY,
          });
          if (coords) {
            view.dispatch(
              view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(coords.pos))),
            );
          }
          void insertFiles(ctx, files);
          return true;
        },
      },
    }),
);
