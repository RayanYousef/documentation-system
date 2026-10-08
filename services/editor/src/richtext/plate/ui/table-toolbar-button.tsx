
// Local changes to the Plate UI registry file: no merge / split (GFM cannot store merged cells); column
// insert / delete keep the column alignment; "Align" items for the cursor column; new tables go through
// insertTable (header row, docs placement rules).
import * as React from 'react';

import type { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

type DropdownMenuProps = React.ComponentProps<typeof DropdownMenuPrimitive.Root>;

import { TablePlugin } from '@platejs/table/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Grid3x3Icon,
  Table,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorPlugin, useEditorSelector } from 'platejs/react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/richtext/plate/ui/dropdown-menu';
import { cn } from '@/richtext/plate/lib/utils';
import { insertColumn, removeColumn, setColumnAlign } from '@/richtext/plate/editor/table';
import { insertTable } from '@/richtext/plate/editor/transforms';

import { ToolbarButton } from './toolbar';

export function TableToolbarButton(props: DropdownMenuProps) {
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: KEYS.table } }),
    []
  );

  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="Table" aria-label="Table" isDropdown>
          <Table />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="flex w-auto min-w-0 flex-col"
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
              <Grid3x3Icon className="size-4" />
              <span>Table</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="m-0 p-0">
              <TablePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>Row</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowUp />
                Insert row before
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow();
                  editor.tf.focus();
                }}
              >
                <ArrowDown />
                Insert row after
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableRow();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete row
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="gap-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>Column</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  insertColumn(editor, { before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowLeft />
                Insert column before
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  insertColumn(editor);
                  editor.tf.focus();
                }}
              >
                <ArrowRight />
                Insert column after
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  removeColumn(editor);
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete column
              </DropdownMenuItem>
              {ALIGN_ITEMS.map(({ value, label, icon }) => (
                <DropdownMenuItem
                  key={label}
                  className="min-w-[180px]"
                  disabled={!tableSelected}
                  onSelect={() => {
                    setColumnAlign(editor, value);
                    editor.tf.focus();
                  }}
                >
                  {icon}
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="min-w-[180px]"
            disabled={!tableSelected}
            onSelect={() => {
              tf.remove.table();
              editor.tf.focus();
            }}
          >
            <Trash2Icon />
            Delete table
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ALIGN_ITEMS = [
  { value: 'left', label: 'Align left', icon: <AlignLeft /> },
  { value: 'center', label: 'Align center', icon: <AlignCenter /> },
  { value: 'right', label: 'Align right', icon: <AlignRight /> },
  { value: null, label: 'Default alignment', icon: <div className="size-4" /> },
] as const;

const PICKER_SIZE = 8;

function TablePicker() {
  const { editor } = useEditorPlugin(TablePlugin);
  const [size, setSize] = React.useState({ colCount: 0, rowCount: 0 });

  return (
    <div
      className="flex! m-0 flex-col p-0"
      onClick={() => {
        if (!size.rowCount) return;
        insertTable(editor, { rows: size.rowCount, cols: size.colCount });
        editor.tf.focus();
      }}
      role="button"
    >
      <div className="grid size-[130px] grid-cols-8 gap-0.5 p-1">
        {Array.from({ length: PICKER_SIZE }, (_, rowIndex) =>
          Array.from({ length: PICKER_SIZE }, (_, colIndex) => (
            <div
              key={`(${rowIndex},${colIndex})`}
              data-testid={`table-picker-${rowIndex + 1}x${colIndex + 1}`}
              className={cn(
                'col-span-1 size-3 border border-solid bg-secondary',
                rowIndex < size.rowCount &&
                  colIndex < size.colCount &&
                  'border-current'
              )}
              onMouseMove={() => {
                setSize({ colCount: colIndex + 1, rowCount: rowIndex + 1 });
              }}
            />
          ))
        )}
      </div>

      <div className="text-center text-current text-xs">
        {size.rowCount} x {size.colCount}
      </div>
    </div>
  );
}
