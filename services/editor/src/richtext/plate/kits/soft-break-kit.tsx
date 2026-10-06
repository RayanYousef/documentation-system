// Shift+Enter inserts a soft break ("\n" in the text). The Markdown export turns it into a hard break
// only in a plain paragraph. In a heading or a list item the break would be lost (a heading becomes a
// setext heading, a list item a wrapped line) and the page would then open only in Raw. So Shift+Enter
// does nothing there.
import { KEYS, type TElement } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

const HEADINGS: readonly string[] = KEYS.heading;

/** Blocks whose Markdown cannot hold a line break. */
export const holdsNoLineBreak = (block: TElement): boolean => HEADINGS.includes(block.type) || !!block.listStyleType;

export const SoftBreakGuardPlugin = createPlatePlugin({ key: 'soft-break-guard' }).overrideEditor(({ editor, tf: { insertSoftBreak } }) => ({
  transforms: {
    insertSoftBreak() {
      const block = editor.api.block<TElement>();
      if (block && holdsNoLineBreak(block[0])) return;
      insertSoftBreak();
    },
  },
}));

export const SoftBreakKit = [SoftBreakGuardPlugin];
