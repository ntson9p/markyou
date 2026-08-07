import type { BlockType } from '@/editors/wysiwyg/selection-state';

/**
 * Everything the formatting toolbar can ask an editor pane to do.
 *
 * Two implementations exist — `createRichToolbarCommands` (Milkdown) and
 * `createSourceToolbarCommands` (CodeMirror) — so in dual mode the toolbar
 * drives whichever pane the cursor was last in. The shared interface keeps the
 * panes in parity: a new toolbar action must be implemented for both.
 */
export interface ToolbarCommands {
  undo(): void;
  redo(): void;
  /** Convert the current block(s) to the given type. */
  setBlockType(type: BlockType): void;
  strong(): void;
  emphasis(): void;
  strikethrough(): void;
  inlineCode(): void;
  /** Start link editing for the current selection. */
  link(): void;
  bulletList(): void;
  orderedList(): void;
  taskList(): void;
  /** Insert a 3×3 table. */
  table(): void;
  image(src: string): void;
  mathInline(): void;
  quote(): void;
  callout(): void;
  divider(): void;
  mathBlock(): void;
  diagram(): void;
}
