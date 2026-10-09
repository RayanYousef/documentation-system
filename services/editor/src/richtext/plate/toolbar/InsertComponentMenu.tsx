// "Insert component": one item per entry in the components manifest (viewers, Tabs, TabItem, generic).
import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import { Puzzle } from 'lucide-react';
import { useDocsComponents } from '../context.js';
import { insertComponent } from '../editor/transforms.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu.js';
import { ToolbarButton } from '../ui/toolbar.js';

export function InsertComponentMenu() {
  const editor = useEditorRef();
  const manifest = useDocsComponents();
  const [open, setOpen] = useState(false);
  if (!manifest.components.length) return null;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="Insert component" aria-label="Insert component" isDropdown>
          <Puzzle />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={(e) => { e.preventDefault(); editor.tf.focus(); }}>
        {manifest.components.map((c) => (
          <DropdownMenuItem key={c.name} onSelect={() => { editor.tf.focus(); insertComponent(editor, manifest, c); }}>
            <code className="font-mono text-xs">{`<${c.name}${c.hasChildren ? '>' : ' />'}`}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
