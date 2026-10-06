// The toolbar above the page. Order: undo / redo | block type | marks | lists |
// link, image by URL, upload image, upload model, from repo, table, code, divider | admonition, tabs, component.
import type { ReactNode } from 'react';
import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { BoldIcon, Code2Icon, FileCode2, ItalicIcon, Minus, StrikethroughIcon, UnderlineIcon } from 'lucide-react';
import { insertCodeBlock, insertDivider } from '../editor/transforms.js';
import { RedoToolbarButton, UndoToolbarButton } from '../ui/history-toolbar-button.js';
import { LinkToolbarButton } from '../ui/link-toolbar-button.js';
import { BulletedListToolbarButton, NumberedListToolbarButton, TodoListToolbarButton } from '../ui/list-toolbar-button.js';
import { MarkToolbarButton } from '../ui/mark-toolbar-button.js';
import { TableToolbarButton } from '../ui/table-toolbar-button.js';
import { ToolbarButton, ToolbarGroup } from '../ui/toolbar.js';
import { TurnIntoToolbarButton } from '../ui/turn-into-toolbar-button.js';
import { InsertAdmonitionMenu } from './InsertAdmonitionMenu.js';
import { InsertComponentMenu } from './InsertComponentMenu.js';
import { InsertFromRepoButton } from './InsertFromRepoButton.js';
import { InsertImageButton } from './InsertImageButton.js';
import { InsertImageUrlButton } from './InsertImageUrlButton.js';
import { InsertModelButton } from './InsertModelButton.js';
import { InsertTabsButton } from './InsertTabsButton.js';

/** Bold, italic, underline, strikethrough, inline code (shared with the floating toolbar). */
export function MarkButtons() {
  const mark = (type: string, label: string, icon: ReactNode) => (
    <MarkToolbarButton nodeType={type} tooltip={label} aria-label={label}>{icon}</MarkToolbarButton>
  );
  return (<>
    {mark(KEYS.bold, 'Bold (Ctrl+B)', <BoldIcon />)}
    {mark(KEYS.italic, 'Italic (Ctrl+I)', <ItalicIcon />)}
    {mark(KEYS.underline, 'Underline (Ctrl+U)', <UnderlineIcon />)}
    {mark(KEYS.strikethrough, 'Strikethrough', <StrikethroughIcon />)}
    {mark(KEYS.code, 'Inline code (Ctrl+E)', <Code2Icon />)}
  </>);
}

function ActionButton({ label, onAction, children }: { label: string; onAction(): void; children: ReactNode }) {
  const editor = useEditorRef();
  return (
    <ToolbarButton tooltip={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={() => { onAction(); editor.tf.focus(); }}>
      {children}
    </ToolbarButton>
  );
}

export function FixedToolbarButtons() {
  const editor = useEditorRef();
  return (
    <div className="flex w-full flex-wrap">
      <ToolbarGroup>
        <UndoToolbarButton aria-label="Undo" />
        <RedoToolbarButton aria-label="Redo" />
      </ToolbarGroup>
      <ToolbarGroup>
        <TurnIntoToolbarButton />
      </ToolbarGroup>
      <ToolbarGroup>
        <MarkButtons />
      </ToolbarGroup>
      <ToolbarGroup>
        <BulletedListToolbarButton aria-label="Bulleted list" />
        <NumberedListToolbarButton aria-label="Numbered list" />
        <TodoListToolbarButton aria-label="To-do list" />
      </ToolbarGroup>
      <ToolbarGroup>
        <LinkToolbarButton aria-label="Link" />
        <InsertImageUrlButton />
        <InsertImageButton />
        <InsertModelButton />
        <InsertFromRepoButton />
        <TableToolbarButton />
        <ActionButton label="Insert code block" onAction={() => insertCodeBlock(editor)}><FileCode2 /></ActionButton>
        <ActionButton label="Insert thematic break" onAction={() => insertDivider(editor)}><Minus /></ActionButton>
      </ToolbarGroup>
      <ToolbarGroup>
        <InsertAdmonitionMenu />
        <InsertTabsButton />
        <InsertComponentMenu />
      </ToolbarGroup>
    </div>
  );
}
