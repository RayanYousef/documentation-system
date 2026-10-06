// From the Plate UI registry `exit-break-kit` (MIT): Ctrl+Enter leaves a code block, quote or table
// (Ctrl+Shift+Enter inserts the new paragraph before it).
import { ExitBreakPlugin } from 'platejs';

export const ExitBreakKit = [
  ExitBreakPlugin.configure({
    shortcuts: {
      insert: { keys: 'mod+enter' },
      insertBefore: { keys: 'mod+shift+enter' },
    },
  }),
];
