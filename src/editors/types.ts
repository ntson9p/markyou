/**
 * Common editor-adapter interface (plan §1.4). App features (find bar,
 * outline jump, mode switching, sync) talk to editors ONLY through this —
 * never through editor internals. Editors talk to the store, never to each
 * other.
 */

/** A re-seekable position anchor: heading path + text offset (plan §2.2). */
export interface SelectionAnchor {
  /** 1-based source line of the nearest enclosing/preceding top-level block. */
  blockLine: number;
  /** Plain-text offset within that block. */
  textOffset: number;
}

export interface EditorAdapter {
  readonly id: 'raw' | 'wysiwyg';
  focus(): void;
  /** Current full text as this editor sees it. */
  getText(): string;
  /**
   * Apply an external (store-originated) text update. Implementations must
   * not re-emit this change back to the store (loop safety) and should
   * preserve cursor/scroll where possible (minimal diff / anchor restore).
   */
  applyText(text: string): void;
  getSelectionAnchor(): SelectionAnchor | null;
  restoreSelectionAnchor(anchor: SelectionAnchor): void;
  /** Scroll the view so the given 1-based source line is visible (outline jump). */
  scrollToLine(line: number): void;
}
