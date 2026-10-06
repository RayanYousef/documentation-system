// The only import path the app uses for the rich text editor. A later editor is a sibling folder of
// ./plate; only the implementation export below changes.
import type { RichTextEditorComponent } from './RichTextEditor.js';
import { PlateRichTextEditor } from './plate/PlateRichTextEditor.js';

export type { RichTextEditorProps, RichTextHandle, RichTextParseError, RichTextServices, RichTextEditorComponent } from './RichTextEditor.js';
export { createRichTextServices, type RichTextSession } from './createRichTextServices.js';
/** Typed as the seam, so the compiler checks the implementation against the interface. */
export const RichTextEditor: RichTextEditorComponent = PlateRichTextEditor;
