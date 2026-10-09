// Where the focus goes when an editor toolbar menu has closed.
import type { PlateEditor } from 'platejs/react';

/**
 * `onCloseAutoFocus` of an editor toolbar menu. A pick has already focused the editor (at the pick, so keys typed
 * right after it are not lost). The menu unmounts only after its close animation, and by then the person may have
 * moved on: a popover or field opened in the meantime keeps the focus (taking it back closed that popover). Only
 * when the focus went down with the menu (Escape, or a pick that did not focus anything) does the editor get it back.
 */
export function returnFocusAfterMenu(editor: PlateEditor, event: Event): void {
  event.preventDefault();
  const active = document.activeElement;
  if (!active || active === document.body) editor.tf.focus();
}
