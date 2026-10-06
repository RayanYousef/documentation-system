// Insert actions for the toolbar buttons and the slash menu. They build the same nodes the
// Markdown import makes, so the output is what the previous editor's buttons wrote.
// Upload and asset listing happen in RichTextServices; these only change the document.
import { getEmptyTableNode } from '@platejs/table';
import { ElementApi, KEYS, PathApi, type Path, type SlateEditor, type TElement, type TNode } from 'platejs';
import type { ComponentDescriptor, ComponentsManifest } from '@platform/contracts';
import type { AssetInsert, ViewerComponent } from '../../assets.js';
import { jsxTypeFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from '../nodes/keys.js';

export const paragraph = (text = ''): TElement => ({ type: KEYS.p, children: [{ text }] });
const leaf = () => [{ text: '' }];

/** Block types whose children are blocks we may insert next to. */
const BLOCK_CONTAINERS: readonly string[] = [DOCS_KEYS.tabItem, DOCS_KEYS.jsxContainer, KEYS.callout];

function canHoldBlocks(editor: SlateEditor, path: Path): boolean {
  if (path.length === 0) return true;
  const node = editor.api.node<TElement>(path)?.[0];
  return !!node && BLOCK_CONTAINERS.includes(node.type);
}

/**
 * Insert block(s) after the block that holds the cursor (inside a TabItem or admonition when the cursor is there,
 * never inside a code block, table or list text). An empty paragraph at the cursor is replaced.
 * Without a selection the blocks go to the end.
 */
export function insertBlocks(editor: SlateEditor, nodes: TElement | TElement[]): void {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  editor.tf.withoutNormalizing(() => {
    const entry = editor.selection
      ? editor.api.above<TElement>({ at: editor.selection, mode: 'lowest', match: (n: TNode, p: Path) => ElementApi.isElement(n) && editor.api.isBlock(n) && canHoldBlocks(editor, PathApi.parent(p)) })
      : undefined;
    const at = entry ? PathApi.next(entry[1]) : [editor.children.length];
    editor.tf.insertNodes(list, { at, select: true });
    if (entry && entry[0].type === KEYS.p && !entry[0].listStyleType && editor.api.isEmpty(entry[0])) editor.tf.removeNodes({ at: entry[1] });
  });
}

/** The manifest entry for a tag, or the first entry edited as `type`. */
const byName = (m: ComponentsManifest, name: string) => m.components.find((c) => c.name === name);
const byType = (m: ComponentsManifest, type: string) => m.components.find((c) => jsxTypeFor(c) === type);
const tagFor = (m: ComponentsManifest, type: string, fallback: string) => byType(m, type)?.name ?? fallback;

// ---------- nodes ----------

export function viewerNode(m: ComponentsManifest, component: ViewerComponent | string, props: Record<string, string | number> = {}): TElement {
  const d = byName(m, component);
  const type = d ? jsxTypeFor(d) : component === 'FbxViewer' ? DOCS_KEYS.fbxViewer : DOCS_KEYS.modelViewer;
  return { type, jsxName: component, ...props, children: leaf() };
}

export function imageNode({ src, alt }: { src: string; alt: string }): TElement {
  // Plate's Markdown rule for `img` reads the src from `url` and the alt from the caption text.
  return { type: KEYS.img, url: src, caption: [{ text: alt }], children: leaf() };
}

export function tabItemNode(m: ComponentsManifest, value: string, label: string, text: string, isDefault = false): TElement {
  return { type: DOCS_KEYS.tabItem, jsxName: tagFor(m, DOCS_KEYS.tabItem, 'TabItem'), value, label, ...(isDefault ? { default: true } : {}), children: [paragraph(text)] };
}

/** Same two tabs the old "Insert tabs" button wrote. */
export function tabsNode(m: ComponentsManifest): TElement {
  return {
    type: DOCS_KEYS.tabs,
    jsxName: tagFor(m, DOCS_KEYS.tabs, 'Tabs'),
    children: [tabItemNode(m, 'one', 'One', 'First tab', true), tabItemNode(m, 'two', 'Two', 'Second tab')],
  };
}

export function componentNode(m: ComponentsManifest, d: ComponentDescriptor): TElement {
  const type = jsxTypeFor(d);
  if (type === DOCS_KEYS.tabs) return { ...tabsNode(m), jsxName: d.name };
  if (type === DOCS_KEYS.tabItem) return tabsNode(m);
  if (type === DOCS_KEYS.jsxContainer) return { type, jsxName: d.name, children: [paragraph()] };
  return { type, jsxName: d.name, children: leaf() };
}

// ---------- insert actions ----------

export const insertViewer = (editor: SlateEditor, m: ComponentsManifest, v: { component: ViewerComponent; src: string; alt: string }) =>
  insertBlocks(editor, viewerNode(m, v.component, { src: v.src, alt: v.alt }));

export const insertImage = (editor: SlateEditor, img: { src: string; alt: string }) => insertBlocks(editor, imageNode(img));

/** A picked repo asset (see repoAssetInsert). */
export function insertAsset(editor: SlateEditor, m: ComponentsManifest, a: AssetInsert): void {
  if (a.kind === 'viewer') insertViewer(editor, m, a);
  else insertImage(editor, a);
}

export const insertTabs = (editor: SlateEditor, m: ComponentsManifest) => insertBlocks(editor, tabsNode(m));

/** Append a tab to the Tabs block at `tabsPath`, with a value no other tab uses. */
export function addTab(editor: SlateEditor, m: ComponentsManifest, tabsPath: Path): void {
  const tabs = editor.api.node<TElement>(tabsPath)?.[0];
  if (!tabs || tabs.type !== DOCS_KEYS.tabs) return;
  const used = new Set(tabs.children.map((c) => (c as TElement).value));
  let n = tabs.children.length + 1;
  while (used.has(`tab${n}`)) n++;
  const at = [...tabsPath, tabs.children.length];
  editor.tf.insertNodes(tabItemNode(m, `tab${n}`, `Tab ${n}`, ''), { at, select: true });
}

/** Insert a manifest component. A TabItem goes into the Tabs around the cursor, or comes as a new Tabs block. */
export function insertComponent(editor: SlateEditor, m: ComponentsManifest, d: ComponentDescriptor): void {
  if (jsxTypeFor(d) === DOCS_KEYS.tabItem && editor.selection) {
    const tabs = editor.api.above<TElement>({ at: editor.selection, match: { type: DOCS_KEYS.tabs } });
    if (tabs) { addTab(editor, m, tabs[1]); return; }
  }
  insertBlocks(editor, componentNode(m, d));
}

export type AdmonitionVariant = 'note' | 'tip' | 'info' | 'caution' | 'danger';
export const ADMONITION_VARIANTS: readonly AdmonitionVariant[] = ['note', 'tip', 'info', 'caution', 'danger'];

/** `:::note` (or another variant) with an empty paragraph; the cursor goes inside. */
export function insertCallout(editor: SlateEditor, variant: AdmonitionVariant): void {
  insertBlocks(editor, { type: KEYS.callout, variant, children: [paragraph()] });
  const entry = editor.api.above<TElement>({ match: { type: KEYS.callout } });
  if (entry) editor.tf.select(editor.api.start(entry[1]));
}

/** A ```text fence (the old default language). */
export const insertCodeBlock = (editor: SlateEditor) =>
  insertBlocks(editor, { type: KEYS.codeBlock, lang: 'text', children: [{ type: KEYS.codeLine, children: leaf() }] });

/** `---` */
export const insertDivider = (editor: SlateEditor) => insertBlocks(editor, { type: KEYS.hr, children: leaf() });

/** A table with a header row (`rows` includes it). The cursor goes to the first cell. */
export function insertTable(editor: SlateEditor, { rows = 2, cols = 2 }: { rows?: number; cols?: number } = {}): void {
  insertBlocks(editor, getEmptyTableNode(editor, { rowCount: rows, colCount: cols, header: true }) as TElement);
  const table = editor.api.above<TElement>({ match: { type: editor.getType(KEYS.table) } });
  if (table) editor.tf.select(editor.api.start(table[1]));
}

const LIST_TYPES: readonly string[] = [KEYS.ul, KEYS.ol, KEYS.listTodo];

/**
 * The basic blocks of the slash menu: text, headings, quote, lists, code, table, divider.
 * Placement follows insertBlocks (so the slash menu's empty paragraph is replaced).
 */
export function insertBasicBlock(editor: SlateEditor, type: string): void {
  if (type === KEYS.table) return insertTable(editor);
  if (type === KEYS.codeBlock) return insertCodeBlock(editor);
  if (type === KEYS.hr) return insertDivider(editor);
  if (LIST_TYPES.includes(type)) {
    return insertBlocks(editor, { type: KEYS.p, indent: 1, listStyleType: type, ...(type === KEYS.listTodo ? { checked: false } : {}), children: leaf() });
  }
  // A quote holds blocks (as the Markdown import builds it).
  if (type === KEYS.blockquote) return insertBlocks(editor, { type, children: [paragraph()] });
  insertBlocks(editor, { type, children: leaf() });
}
