// The in-page editor: EditorKit's plugins (content, caret sync, block selection, drag handles, "/" menu,
// Ctrl+Enter exits) with the page-look components and the page toolbars.
import { BlockSelectionKit } from './block-selection-kit.js';
import { CaretSyncKit } from './caret-sync-kit.js';
import { ContentKit } from './content-kit.js';
import { DraggableDndKit } from './dnd-kit.js';
import { ExitBreakKit } from './exit-break-kit.js';
import { withPageLook } from './page-look-kit.js';
import { PageToolbarKit } from './page-toolbar-kit.js';
import { SlashKit } from './slash-kit.js';

export const PageEditorKit = withPageLook([
  ...ContentKit,
  ...CaretSyncKit,
  ...BlockSelectionKit,
  ...DraggableDndKit,
  ...SlashKit,
  ...ExitBreakKit,
  ...PageToolbarKit,
]);
