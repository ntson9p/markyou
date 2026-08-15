import { keymap } from '@milkdown/kit/prose/keymap';
import { TextSelection, type Command } from '@milkdown/kit/prose/state';
import { isInTable, selectionCell, TableMap } from '@milkdown/kit/prose/tables';
import { $prose } from '@milkdown/kit/utils';

/**
 * Enter inside a table moves to the cell below (FR-5.7).
 *
 * The gfm preset binds plain Enter to the same `ExitTable` command as
 * Mod-Enter, and `ExitTable` appends a paragraph after the *whole* table. So
 * Enter in the first cell of a 3x3 skipped two untouched rows and landed below
 * everything, with nothing on screen to say a jump had happened.
 *
 * A markdown cell can't hold a line break, so Enter has to mean something other
 * than "split this block". The spreadsheet meaning — down one row, same column
 * — is the one Tab already implies by moving right.
 */
const moveToCellBelow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  // A range selection means Enter is about replacing content, not navigating.
  if (!state.selection.empty) return false;

  const $cell = selectionCell(state);
  // `selectionCell` resolves to the position *before* the cell, i.e. inside the
  // row — so the table is one level up from there.
  const table = $cell.node(-1);
  const tableStart = $cell.start(-1);
  const map = TableMap.get(table);
  const rect = map.findCell($cell.pos - tableStart);

  // Bottom row: hand Enter back to the preset, whose ExitTable still leaves the
  // table exactly as it did before. Keeping that fall-through is what makes
  // this change additive rather than a replacement.
  if (rect.bottom >= map.height) return false;

  if (dispatch) {
    const below = tableStart + map.map[rect.bottom * map.width + rect.left];
    const selection = TextSelection.near(state.doc.resolve(below), 1);
    dispatch(state.tr.setSelection(selection).scrollIntoView());
  }
  return true;
};

/**
 * Registered ahead of the gfm preset so this binding wins the Enter it would
 * otherwise route straight to ExitTable.
 */
export const tableEnterKeymap = $prose(() => keymap({ Enter: moveToCellBelow }));
