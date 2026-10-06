// From the Plate UI registry `table-kit` (MIT). The table node is trimmed to what GFM can store.
// Cells keep paragraphs and images only (see normalizeCellChildren in editor/table.ts).
import { ElementApi, KEYS, type NodeEntry, type TElement } from 'platejs';
import { TableCellHeaderPlugin, TableCellPlugin, TablePlugin, TableRowPlugin } from '@platejs/table/react';
import { createPlatePlugin } from 'platejs/react';
import { normalizeCellChildren } from '../editor/table.js';
import { TableCellElement, TableCellHeaderElement, TableElement, TableRowElement } from '../ui/table-node.js';

/** Keeps every td / th to one line of text: GFM has no blocks inside a cell. */
export const TableCellBlocksPlugin = createPlatePlugin({ key: 'table-cell-blocks' }).overrideEditor(({ editor, tf: { normalizeNode } }) => ({
  transforms: {
    normalizeNode(entry, options) {
      const [node] = entry;
      const isCell = ElementApi.isElement(node) && (node.type === editor.getType(KEYS.td) || node.type === editor.getType(KEYS.th));
      if (isCell && normalizeCellChildren(editor, entry as NodeEntry<TElement>)) return;
      normalizeNode(entry, options);
    },
  },
}));

export const TableKit = [
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),
  TableCellBlocksPlugin,
];
