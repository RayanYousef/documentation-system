// The Plate implementation of RichTextEditor: the docs content, block drag handles and selection, the
// "/" menu, the fixed and floating toolbars and the link toolbar. Read-only hides every toolbar.
import type { RichTextEditorProps } from '../RichTextEditor.js';
import { DocsEditorProvider } from './context.js';
import { EditorKit } from './kits/editor-kit.js';
import { PlateDocument } from './PlateDocument.js';
import { TooltipProvider } from './ui/tooltip.js';

export function PlateRichTextEditor({ markdown, readOnly, components, services, onChange, onParseError, ref }: RichTextEditorProps) {
  return (
    <DocsEditorProvider services={services} components={components}>
      <TooltipProvider>
        <PlateDocument ref={ref} markdown={markdown} readOnly={readOnly} components={components} onChange={onChange} onParseError={onParseError} plugins={EditorKit} />
      </TooltipProvider>
    </DocsEditorProvider>
  );
}
