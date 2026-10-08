// Insert the same two-tab <Tabs> block the old button wrote.
import { useEditorRef } from 'platejs/react';
import { Layers } from 'lucide-react';
import { useDocsComponents } from '../context.js';
import { insertTabs } from '../editor/transforms.js';
import { ToolbarButton } from '../ui/toolbar.js';

export function InsertTabsButton() {
  const editor = useEditorRef();
  const manifest = useDocsComponents();
  return (
    <ToolbarButton tooltip="Insert tabs" aria-label="Insert tabs" onMouseDown={(e) => e.preventDefault()} onClick={() => { insertTabs(editor, manifest); editor.tf.focus(); }}>
      <Layers />
    </ToolbarButton>
  );
}
