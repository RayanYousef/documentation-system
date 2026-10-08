// Column tools for GFM tables. Markdown stores one alignment per column (|:---|:---:|---:|), kept on the
// table node as `align` (see the table rule in markdown/docsMarkdown.ts). Inserting or removing a column
// must move those entries with it, so the toolbars use these helpers instead of the raw Plate transforms.
// Cells: what a cell may hold (normalizeCellChildren) and the input-rule switch for cells (outsideTable), at the end.
import { BaseTablePlugin } from '@platejs/table';
import { ElementApi, KEYS, TextApi, type Descendant, type NodeEntry, type Path, type SlateEditor, type TElement } from 'platejs';

export type ColumnAlign = 'left' | 'center' | 'right' | null;

interface CellAt { table: TElement; tablePath: Path; col: number }

function cellAt(editor: SlateEditor): CellAt | undefined {
  const cell = editor.api.above<TElement>({ match: { type: [editor.getType(KEYS.td), editor.getType(KEYS.th)] } });
  if (!cell) return undefined;
  const path = cell[1];
  const tablePath = path.slice(0, -2);
  const table = editor.api.node<TElement>(tablePath)?.[0];
  if (!table || table.type !== editor.getType(KEYS.table)) return undefined;
  return { table, tablePath, col: path[path.length - 1] ?? 0 };
}

const alignOf = (table: TElement): ColumnAlign[] => (Array.isArray(table.align) ? [...(table.align as ColumnAlign[])] : []);

function writeAlign(editor: SlateEditor, tablePath: Path, align: ColumnAlign[]): void {
  while (align.length && align[align.length - 1] == null) align.pop();
  if (align.length) editor.tf.setNodes({ align }, { at: tablePath });
  else editor.tf.unsetNodes('align', { at: tablePath });
}

/** Alignment of the column that holds the cursor; null when none is set or the cursor is not in a table. */
export function columnAlign(editor: SlateEditor): ColumnAlign {
  const at = cellAt(editor);
  return at ? alignOf(at.table)[at.col] ?? null : null;
}

/** Sets (or, with null, clears) the alignment of the column that holds the cursor. */
export function setColumnAlign(editor: SlateEditor, value: ColumnAlign): void {
  const at = cellAt(editor);
  if (!at) return;
  const align = alignOf(at.table);
  while (align.length <= at.col) align.push(null);
  align[at.col] = value;
  writeAlign(editor, at.tablePath, align);
}

/** Inserts a column after (or before) the cursor column; the new column has no alignment. */
export function insertColumn(editor: SlateEditor, { before = false }: { before?: boolean } = {}): void {
  const at = cellAt(editor);
  if (!at) return;
  editor.getTransforms(BaseTablePlugin).insert.tableColumn({ before });
  const align = alignOf(at.table);
  const index = before ? at.col : at.col + 1;
  if (index < align.length) {
    align.splice(index, 0, null);
    writeAlign(editor, at.tablePath, align);
  }
}

/** Removes the cursor column and its alignment. */
export function removeColumn(editor: SlateEditor): void {
  const at = cellAt(editor);
  if (!at) return;
  editor.getTransforms(BaseTablePlugin).remove.tableColumn();
  const align = alignOf(at.table);
  if (at.col < align.length) {
    align.splice(at.col, 1);
    // The column may have been the last one, which removes the table.
    if (editor.api.node<TElement>(at.tablePath)?.[0].type === editor.getType(KEYS.table)) writeAlign(editor, at.tablePath, align);
  }
}

// ---------- cells hold one line of text ----------
// A GFM cell is one line of inline text. Plate lets a cell hold any block, and its table writer then puts
// a code block, a list or a heading inline in the row, which breaks the page. So cells keep paragraphs
// (and images) only; a second paragraph is written as <br/>, which the import reads back.

/** Paragraph props that turn it into a list item (written as <ul><li> inside a cell). */
const LIST_PROPS = [KEYS.listType, KEYS.indent, KEYS.listStart, KEYS.listRestart, KEYS.listRestartPolite, KEYS.listChecked] as const;

const plainText = (node: Descendant): string =>
  TextApi.isText(node) ? node.text : node.children.map(plainText).join(node.type === KEYS.codeBlock ? ' ' : '');

/** For input rules: false inside a table, so `# `, `> `, `- `, `---` and ``` stay text in a cell. */
export const outsideTable = ({ editor }: { editor: SlateEditor }): boolean =>
  !editor.api.above({ match: { type: editor.getType(KEYS.table) } });

/**
 * Normalizer for td / th. Fixes the first child that is not a plain paragraph or an image:
 * - a paragraph with list props: the props are removed
 * - a code block: a paragraph with its lines joined by spaces
 * - a block that holds blocks (quote, admonition, component): unwrapped
 * - any other void block (viewer, rule, comment): an empty paragraph
 * - any other text block (heading): a paragraph
 * Returns true when it changed something (normalizing runs again).
 */
export function normalizeCellChildren(editor: SlateEditor, [cell, path]: NodeEntry<TElement>): boolean {
  const p = editor.getType(KEYS.p);
  for (const [i, child] of cell.children.entries()) {
    if (!ElementApi.isElement(child)) continue;
    const at: Path = [...path, i];
    if (child.type === p) {
      const props = LIST_PROPS.filter((k) => child[k] !== undefined);
      if (!props.length) continue;
      editor.tf.unsetNodes([...props], { at });
      return true;
    }
    if (child.type === editor.getType(KEYS.img)) continue;
    editor.tf.withoutNormalizing(() => {
      if (child.type === editor.getType(KEYS.codeBlock)) {
        editor.tf.removeNodes({ at });
        editor.tf.insertNodes({ type: p, children: [{ text: plainText(child) }] }, { at });
      } else if (child.children.length && child.children.every((c) => ElementApi.isElement(c) && editor.api.isBlock(c))) {
        editor.tf.unwrapNodes({ at });
      } else if (editor.api.isVoid(child)) {
        editor.tf.removeNodes({ at });
        editor.tf.insertNodes({ type: p, children: [{ text: '' }] }, { at });
      } else {
        editor.tf.setNodes({ type: p }, { at });
      }
    });
    return true;
  }
  return false;
}
