// Typing, Enter or Backspace right after a caret move (a click, End, Home) must act where the caret is.
// Slate reads the browser selection on `selectionchange`, throttled to 100 ms. Typed text goes to the
// browser's caret (the input's target range), but Slate then puts its own, older selection back. In
// blocks with non-editable parts (admonition label, tab and viewer props) that older selection won, so a
// fast typist's text after the first letter landed at the previous caret. Taking the browser selection
// over just before each input (text, Enter, Backspace) keeps Slate's selection current. IME composition is left alone.
import { RangeApi } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

export const CaretSyncPlugin = createPlatePlugin({
  key: 'caret-sync',
  handlers: {
    onDOMBeforeInput: ({ editor, event }) => {
      // Plate hands the handler either the native InputEvent or React's wrapper around it.
      const input = ('nativeEvent' in event ? event.nativeEvent : event) as InputEvent;
      if (input.isComposing || input.inputType.includes('Composition') || editor.api.isComposing()) return;
      const dom = window.getSelection();
      if (!dom || dom.rangeCount === 0) return;
      const range = editor.api.toSlateRange(dom, { exactMatch: false, suppressThrow: true });
      if (range && (!editor.selection || !RangeApi.equals(range, editor.selection))) editor.tf.select(range);
    },
  },
});

export const CaretSyncKit = [CaretSyncPlugin];
