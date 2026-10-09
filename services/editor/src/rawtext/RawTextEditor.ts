/**
 * The raw text editor seam (the whole file: frontmatter + Markdown/MDX body). The in-place editor only
 * knows this interface; the CodeMirror 6 implementation lives in ./codemirror, and a later editor is a
 * new sibling folder with only ./index.ts changing.
 */
import type { ReactElement } from 'react';

export interface RawTextEditorProps {
  /** The full text. A change from outside (Visual -> Raw, reload) replaces the document. */
  value: string;
  readOnly: boolean;
  /** Accessible name of the text area. */
  ariaLabel: string;
  /** Every user edit, with the full new text. */
  onChange(value: string): void;
}

export type RawTextEditorComponent = (props: RawTextEditorProps) => ReactElement | null;
