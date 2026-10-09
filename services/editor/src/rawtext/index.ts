// The only import path the in-place editor uses for raw (whole-file) editing. A later editor is a sibling
// folder of ./codemirror; only the implementation export below changes.
import type { RawTextEditorComponent } from './RawTextEditor.js';
import { CodeMirrorRawEditor } from './codemirror/CodeMirrorRawEditor.js';

export type { RawTextEditorProps, RawTextEditorComponent } from './RawTextEditor.js';
/** Typed as the seam, so the compiler checks the implementation against the interface. */
export const RawTextEditor: RawTextEditorComponent = CodeMirrorRawEditor;
