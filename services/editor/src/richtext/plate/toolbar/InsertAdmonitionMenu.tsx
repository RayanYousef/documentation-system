// "Insert admonition": :::note, :::tip, :::info, :::caution, :::danger.
import { useState } from 'react';
import { useEditorRef } from 'platejs/react';
import { MessageSquareWarning } from 'lucide-react';
import { ADMONITION_VARIANTS, insertCallout } from '../editor/transforms.js';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu.js';
import { ToolbarButton } from '../ui/toolbar.js';

const LABEL = 'Insert admonition';

export function InsertAdmonitionMenu() {
  const editor = useEditorRef();
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip={LABEL} aria-label={LABEL} isDropdown>
          <MessageSquareWarning />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onCloseAutoFocus={(e) => { e.preventDefault(); editor.tf.focus(); }}>
        {ADMONITION_VARIANTS.map((v) => (
          <DropdownMenuItem key={v} onSelect={() => insertCallout(editor, v)}>
            <code className="font-mono text-xs">:::{v}</code>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
