// Plugin lists for the docs editor. Free Plate parts only: no AI, comments, suggestions,
// collaboration or upload server.
import { DocsMarkdownPlugin } from '../markdown/docsMarkdown.js';
import { DocsNodesKit } from '../nodes/docsNodesKit.js';
import { BasicBlocksKit } from './basic-blocks-kit.js';
import { BasicMarksKit } from './basic-marks-kit.js';
import { BlockSelectionKit } from './block-selection-kit.js';
import { CodeBlockKit } from './code-block-kit.js';
import { DndKit } from './dnd-kit.js';
import { LinkKit } from './link-kit.js';
import { ListKit } from './list-kit.js';
import { SoftBreakKit } from './soft-break-kit.js';
import { TableKit } from './table-kit.js';

/** Element, mark and Markdown plugins: enough to import, export and (headless) edit a page. */
export const ContentKit = [
  ...BasicBlocksKit,
  ...BasicMarksKit,
  ...ListKit,
  ...CodeBlockKit,
  ...TableKit,
  ...LinkKit,
  ...DocsNodesKit,
  ...SoftBreakKit,
  DocsMarkdownPlugin,
];

/** What a rendered editor needs on top: drag and drop and block selection (table rows use both). Toolbars arrive in S5. */
export const CoreKit = [...ContentKit, ...BlockSelectionKit, ...DndKit];
