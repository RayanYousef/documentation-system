// Local change to the Plate UI registry file: plain toggle buttons. The registry's split buttons offer
// circle, square, roman and letter list styles, which Markdown cannot store.
import * as React from 'react';

import { ListStyleType, someList, toggleList } from '@platejs/list';
import {
  useIndentTodoToolBarButton,
  useIndentTodoToolBarButtonState,
} from '@platejs/list/react';
import { List, ListOrdered, ListTodoIcon } from 'lucide-react';
import { useEditorRef, useEditorSelector } from 'platejs/react';

import { ToolbarButton } from './toolbar';

export function BulletedListToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef();
  const pressed = useEditorSelector(
    (editor) =>
      someList(editor, [
        ListStyleType.Disc,
        ListStyleType.Circle,
        ListStyleType.Square,
      ]),
    []
  );

  return (
    <ToolbarButton
      {...props}
      pressed={pressed}
      onClick={() => toggleList(editor, { listStyleType: ListStyleType.Disc })}
      onMouseDown={(e) => e.preventDefault()}
      tooltip="Bulleted list"
    >
      <List />
    </ToolbarButton>
  );
}

export function NumberedListToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef();
  const pressed = useEditorSelector(
    (editor) => someList(editor, [ListStyleType.Decimal]),
    []
  );

  return (
    <ToolbarButton
      {...props}
      pressed={pressed}
      onClick={() =>
        toggleList(editor, { listStyleType: ListStyleType.Decimal })
      }
      onMouseDown={(e) => e.preventDefault()}
      tooltip="Numbered list"
    >
      <ListOrdered />
    </ToolbarButton>
  );
}

export function TodoListToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const state = useIndentTodoToolBarButtonState({ nodeType: 'todo' });
  const { props: buttonProps } = useIndentTodoToolBarButton(state);

  return (
    <ToolbarButton {...props} {...buttonProps} tooltip="Todo">
      <ListTodoIcon />
    </ToolbarButton>
  );
}
