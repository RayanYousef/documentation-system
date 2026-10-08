// Trimmed from the Plate UI registry `table-node` (MIT). Removed everything a GFM pipe table cannot
// store: column / row resizing and margins, cell background colours, merge / split and the border menu.
// Kept: row drag, block selection, and the floating toolbar with insert / delete row and column and
// delete table. Added: column alignment (GFM |:---|:---:|---:|); column insert / delete keep it in step.
import * as React from 'react';

import { useDraggable, useDropLine } from '@platejs/dnd';
import {
  BlockSelectionPlugin,
  useBlockSelected,
} from '@platejs/selection/react';
import {
  TablePlugin,
  TableProvider,
  useTableElement,
  useTableSelectionDom,
} from '@platejs/table/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import {
  type TElement,
  type TTableCellElement,
  type TTableElement,
  type TTableRowElement,
  KEYS,
  PathApi,
} from 'platejs';
import {
  type PlateElementProps,
  PlateElement,
  useComposedRef,
  useEditorPlugin,
  useEditorRef,
  useEditorSelector,
  useElement,
  useElementSelector,
  useFocusedLast,
  usePluginOption,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
  withHOC,
} from 'platejs/react';

import { Button } from '@/richtext/plate/ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/richtext/plate/ui/popover';
import { cn } from '@/richtext/plate/lib/utils';
import {
  type ColumnAlign,
  columnAlign,
  insertColumn,
  removeColumn,
  setColumnAlign,
} from '@/richtext/plate/editor/table';

import { blockSelectionVariants } from './block-selection';
import { Toolbar, ToolbarButton, ToolbarGroup } from './toolbar';

export const TableElement = withHOC(
  TableProvider,
  function TableElement({
    children,
    ...props
  }: PlateElementProps<TTableElement>) {
    const readOnly = useReadOnly();
    const isSelectionAreaVisible = usePluginOption(
      BlockSelectionPlugin,
      'isSelectionAreaVisible'
    );
    const hasControls = !readOnly && !isSelectionAreaVisible;
    const { props: tableProps } = useTableElement();
    const tableRef = React.useRef<HTMLTableElement>(null);
    useTableSelectionDom(tableRef);

    const isSelectingTable = useBlockSelected(props.element.id as string);

    const content = (
      <PlateElement
        {...props}
        className={cn(
          'overflow-x-auto py-5',
          hasControls && '-ml-2 *:data-[slot=block-selection]:left-2'
        )}
      >
        <div className="group/table relative w-fit">
          <table
            ref={tableRef}
            className={cn(
              'mr-0 ml-px table h-px border-collapse',
              'data-[table-selecting=true]:[&_*::selection]:!bg-transparent',
              'data-[table-selecting=true]:[&_*::selection]:!text-inherit',
              'data-[table-selecting=true]:[&_*]:!caret-transparent'
            )}
            {...tableProps}
          >
            <tbody className="min-w-full">{children}</tbody>
          </table>

          {isSelectingTable && (
            <div className={blockSelectionVariants()} contentEditable={false} />
          )}
        </div>
      </PlateElement>
    );

    if (readOnly) {
      return content;
    }

    return <TableFloatingToolbar>{content}</TableFloatingToolbar>;
  }
);

function TableFloatingToolbar({
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const selectedCellCount = useEditorSelector(
    (editor) =>
      editor.getApi(TablePlugin).table.getSelectedCellIds()?.length ?? 0,
    []
  );
  const selected = useSelected();
  const isFocusedLast = useFocusedLast();
  // A count of zero means the selection (caret or range) stays inside one cell.
  const isToolbarOpen = isFocusedLast && selected && selectedCellCount === 0;

  return (
    <Popover open={isToolbarOpen} modal={false}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      {isToolbarOpen && <TableFloatingToolbarContent {...props} />}
    </Popover>
  );
}

function TableFloatingToolbarContent(
  props: React.ComponentProps<typeof PopoverContent>
) {
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const element = useElement<TTableElement>();
  const { props: buttonProps } = useRemoveNodeButton({ element });
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();
  const align = useEditorSelector((editor) => columnAlign(editor), []);
  const alignButton = (value: ColumnAlign, label: string, icon: React.ReactNode) => (
    <ToolbarButton
      pressed={align === value}
      onClick={() => setColumnAlign(editor, align === value ? null : value)}
      onMouseDown={keepFocus}
      tooltip={label}
      aria-label={label}
    >
      {icon}
    </ToolbarButton>
  );

  return (
    <PopoverContent
      asChild
      onOpenAutoFocus={(e) => e.preventDefault()}
      contentEditable={false}
      {...props}
    >
      <Toolbar
        className="scrollbar-hide flex w-auto max-w-[80vw] flex-row overflow-x-auto rounded-md border bg-popover p-1 shadow-md print:hidden"
        contentEditable={false}
      >
        <ToolbarGroup>
          <ToolbarButton tooltip="Delete table" {...buttonProps}>
            <Trash2Icon />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => tf.insert.tableRow({ before: true })}
            onMouseDown={keepFocus}
            tooltip="Insert row before"
          >
            <ArrowUp />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => tf.insert.tableRow()}
            onMouseDown={keepFocus}
            tooltip="Insert row after"
          >
            <ArrowDown />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => tf.remove.tableRow()}
            onMouseDown={keepFocus}
            tooltip="Delete row"
          >
            <XIcon />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => insertColumn(editor, { before: true })}
            onMouseDown={keepFocus}
            tooltip="Insert column before"
          >
            <ArrowLeft />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertColumn(editor)}
            onMouseDown={keepFocus}
            tooltip="Insert column after"
          >
            <ArrowRight />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => removeColumn(editor)}
            onMouseDown={keepFocus}
            tooltip="Delete column"
          >
            <XIcon />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          {alignButton('left', 'Align column left', <AlignLeft />)}
          {alignButton('center', 'Align column center', <AlignCenter />)}
          {alignButton('right', 'Align column right', <AlignRight />)}
        </ToolbarGroup>
      </Toolbar>
    </PopoverContent>
  );
}

export function TableRowElement({
  children,
  ...props
}: PlateElementProps<TTableRowElement>) {
  const { element } = props;
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    'isSelectionAreaVisible'
  );
  const hasControls = !readOnly && !isSelectionAreaVisible;

  const { isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    type: element.type,
    canDropNode: ({ dragEntry, dropEntry }) =>
      !!dragEntry &&
      PathApi.equals(
        PathApi.parent(dragEntry[1]),
        PathApi.parent(dropEntry[1])
      ),
    onDropHandler: (_, { dragItem }) => {
      const dragElement = (dragItem as { element: TElement }).element;

      if (dragElement) {
        editor.tf.select(dragElement);
      }
    },
  });

  return (
    <PlateElement
      {...props}
      ref={useComposedRef(props.ref, previewRef, nodeRef)}
      as="tr"
      className={cn('group/row', isDragging && 'opacity-50')}
    >
      {hasControls && (
        <td
          className="relative w-2 min-w-2 max-w-2 select-none p-0"
          contentEditable={false}
        >
          <RowDragHandle dragRef={handleRef} />
          <RowDropLine />
        </td>
      )}

      {children}
    </PlateElement>
  );
}

function RowDragHandle({ dragRef }: { dragRef: React.Ref<HTMLButtonElement> }) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <Button
      ref={dragRef}
      variant="outline"
      className={cn(
        '-translate-y-1/2 absolute top-1/2 left-0 z-51 h-6 w-4 p-0 focus-visible:ring-0 focus-visible:ring-offset-0',
        'cursor-grab active:cursor-grabbing',
        'opacity-0 transition-opacity duration-100 group-hover/row:opacity-100'
      )}
      onClick={() => {
        editor.tf.select(element);
      }}
    >
      <GripVertical className="text-muted-foreground" />
    </Button>
  );
}

function RowDropLine() {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      className={cn(
        'absolute inset-x-0 left-2 z-50 h-0.5 bg-brand/50',
        dropLine === 'top' ? '-top-px' : '-bottom-px'
      )}
    />
  );
}

export function TableCellElement({
  isHeader,
  ...props
}: PlateElementProps<TTableCellElement> & {
  isHeader?: boolean;
}) {
  const element = props.element;

  const tableId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.table,
  });
  const rowId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.tr,
  });
  const isSelectingTable = useBlockSelected(tableId);
  const isSelectingRow = useBlockSelected(rowId) || isSelectingTable;

  return (
    <PlateElement
      {...props}
      as={isHeader ? 'th' : 'td'}
      className={cn(
        'relative h-full min-w-16 overflow-visible border border-border bg-background p-0',
        isHeader && 'bg-muted text-left font-semibold *:m-0',
        'data-[table-cell-selected=true]:bg-brand/5'
      )}
      attributes={{
        ...props.attributes,
        'data-table-cell-id': element.id,
      }}
    >
      <div className="relative z-20 box-border h-full px-3 py-2">
        {props.children}
      </div>

      {isSelectingRow && (
        <div className={blockSelectionVariants()} contentEditable={false} />
      )}
    </PlateElement>
  );
}

export function TableCellHeaderElement(
  props: React.ComponentProps<typeof TableCellElement>
) {
  return <TableCellElement {...props} isHeader />;
}
