// The full docs editor: content, drag handles, block selection, the "/" menu, Ctrl+Enter exits and the
// toolbars. No autoformat kit: it replaces text like "->" or "(c)" with symbols, also inside code spans.
// Markdown shortcuts ("# ", "* ", "> ", "```", "**") come from the input rules of the content kits.
import { BlockSelectionKit } from './block-selection-kit.js';
import { CaretSyncKit } from './caret-sync-kit.js';
import { ContentKit } from './content-kit.js';
import { DraggableDndKit } from './dnd-kit.js';
import { ExitBreakKit } from './exit-break-kit.js';
import { SlashKit } from './slash-kit.js';
import { ToolbarKit } from './toolbar-kit.js';

export const EditorKit = [
  ...ContentKit,
  ...CaretSyncKit,
  ...BlockSelectionKit,
  ...DraggableDndKit,
  ...SlashKit,
  ...ExitBreakKit,
  ...ToolbarKit,
];
