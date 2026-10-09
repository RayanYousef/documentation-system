// Plate plugins for our own blocks: manifest components, generated okf blocks, comments,
// admonitions and images. Normalizers keep the shape Tabs > TabItem > blocks.
import { CalloutPlugin } from '@platejs/callout/react';
import { ElementApi, KEYS, PathApi, TextApi, type Descendant, type NodeEntry, type Path, type SlateEditor, type TElement } from 'platejs';
import { createPlatePlugin } from 'platejs/react';
import { CalloutElement } from './CalloutElement.js';
import { GenericJsxContainerElement, GenericJsxVoidElement } from './GenericJsxElement.js';
import { ImageElement } from './ImageElement.js';
import { DOCS_KEYS } from './keys.js';
import { MdxCommentElement, MdxInlineCommentElement } from './MdxCommentElement.js';
import { OkfGeneratedElement } from './OkfGeneratedElement.js';
import { TabItemElement } from './TabItemElement.js';
import { TabsElement } from './TabsElement.js';
import { ViewerElement } from './ViewerElement.js';

export const ModelViewerPlugin = createPlatePlugin({ key: DOCS_KEYS.modelViewer, node: { isElement: true, isVoid: true, component: ViewerElement } });
export const FbxViewerPlugin = createPlatePlugin({ key: DOCS_KEYS.fbxViewer, node: { isElement: true, isVoid: true, component: ViewerElement } });
const isBlockNode = (editor: SlateEditor, n: Descendant): n is TElement => ElementApi.isElement(n) && editor.api.isBlock(n);
const emptyParagraph = (text = ''): TElement => ({ type: KEYS.p, children: [{ text }] });

/** Children of a block container must be blocks: wrap stray text or inline nodes in a paragraph. */
function wrapInlineChildren(editor: SlateEditor, [node, path]: NodeEntry<TElement>): boolean {
  const i = node.children.findIndex((c) => !isBlockNode(editor, c));
  if (i < 0) return false;
  editor.tf.wrapNodes({ type: KEYS.p, children: [] }, { at: [...path, i] });
  return true;
}

/**
 * A generated okf block stays an HTML comment pair, which is not valid MDX inside a component. When one is
 * dragged or pasted into a TabItem or a generic container, move it out to just after `outside`.
 */
function moveOkfOut(editor: SlateEditor, [node, path]: NodeEntry<TElement>, outside: Path): boolean {
  const i = node.children.findIndex((c) => ElementApi.isElement(c) && c.type === DOCS_KEYS.okfGenerated);
  if (i < 0) return false;
  editor.tf.moveNodes({ at: [...path, i], to: PathApi.next(outside) });
  return true;
}

/**
 * Tabs holds only TabItems:
 * - no TabItems left (only an empty text): the block becomes an empty paragraph
 * - any other child: wrapped in a new TabItem
 */
function normalizeTabs(editor: SlateEditor, [node, path]: NodeEntry<TElement>): boolean {
  if (node.children.every((c) => TextApi.isText(c))) {
    editor.tf.withoutNormalizing(() => {
      editor.tf.removeNodes({ at: path });
      editor.tf.insertNodes(emptyParagraph(node.children.map((c) => (c as { text: string }).text).join('')), { at: path });
    });
    return true;
  }
  const i = node.children.findIndex((c) => !ElementApi.isElement(c) || c.type !== DOCS_KEYS.tabItem);
  if (i < 0) return false;
  const at: Path = [...path, i];
  const child = node.children[i]!;
  if (TextApi.isText(child) && child.text === '') editor.tf.removeNodes({ at });
  else editor.tf.wrapNodes({ type: DOCS_KEYS.tabItem, value: `tab${i + 1}`, label: `Tab ${i + 1}`, children: [] }, { at });
  return true;
}

export const TabsPlugin = createPlatePlugin({ key: DOCS_KEYS.tabs, node: { isElement: true, component: TabsElement } }).overrideEditor(
  ({ editor, tf: { normalizeNode } }) => ({
    transforms: {
      normalizeNode(entry, options) {
        const [node] = entry;
        if (ElementApi.isElement(node) && node.type === DOCS_KEYS.tabs && normalizeTabs(editor, entry as NodeEntry<TElement>)) return;
        normalizeNode(entry, options);
      },
    },
  }),
);

/**
 * A TabItem holds blocks (no okf block) and lives in a Tabs block (one outside Tabs gets wrapped in a new Tabs).
 * Only one tab of a group can be the default: the site shows the first tab marked `default`, so making another
 * tab the default (the checkbox in its props) clears the mark on the others.
 */
export const TabItemPlugin = createPlatePlugin({ key: DOCS_KEYS.tabItem, node: { isElement: true, component: TabItemElement } }).overrideEditor(
  ({ editor, tf: { apply, normalizeNode } }) => ({
    transforms: {
      apply(op) {
        apply(op);
        if (op.type !== 'set_node' || op.newProperties['default'] !== true) return;
        const made = editor.api.node<TElement>(op.path)?.[0];
        if (!made || made.type !== DOCS_KEYS.tabItem) return;
        const groupPath = PathApi.parent(op.path);
        const group = editor.api.node<TElement>(groupPath)?.[0];
        if (!group || !ElementApi.isElement(group)) return;
        editor.tf.withoutNormalizing(() => {
          group.children.forEach((child, i) => {
            if (i !== op.path[op.path.length - 1] && ElementApi.isElement(child) && child['default'] === true) editor.tf.unsetNodes('default', { at: [...groupPath, i] });
          });
        });
      },
      normalizeNode(entry, options) {
        const [node, path] = entry;
        if (ElementApi.isElement(node) && node.type === DOCS_KEYS.tabItem) {
          const parent = editor.api.parent<TElement>(path);
          if (!parent || !ElementApi.isElement(parent[0]) || parent[0].type !== DOCS_KEYS.tabs) {
            editor.tf.wrapNodes({ type: DOCS_KEYS.tabs, children: [] }, { at: path });
            return;
          }
          if (moveOkfOut(editor, entry as NodeEntry<TElement>, parent[1])) return;
          if (wrapInlineChildren(editor, entry as NodeEntry<TElement>)) return;
        }
        normalizeNode(entry, options);
      },
    },
  }),
);

export const JsxVoidPlugin = createPlatePlugin({ key: DOCS_KEYS.jsxVoid, node: { isElement: true, isVoid: true, component: GenericJsxVoidElement } });
/** A generic container holds blocks (no okf block). */
export const JsxContainerPlugin = createPlatePlugin({ key: DOCS_KEYS.jsxContainer, node: { isElement: true, component: GenericJsxContainerElement } }).overrideEditor(
  ({ editor, tf: { normalizeNode } }) => ({
    transforms: {
      normalizeNode(entry, options) {
        const [node] = entry;
        if (ElementApi.isElement(node) && node.type === DOCS_KEYS.jsxContainer) {
          const el = entry as NodeEntry<TElement>;
          if (moveOkfOut(editor, el, el[1]) || wrapInlineChildren(editor, el)) return;
        }
        normalizeNode(entry, options);
      },
    },
  }),
);
export const OkfGeneratedPlugin = createPlatePlugin({ key: DOCS_KEYS.okfGenerated, node: { isElement: true, isVoid: true, component: OkfGeneratedElement } });
export const MdxCommentPlugin = createPlatePlugin({ key: DOCS_KEYS.mdxComment, node: { isElement: true, isVoid: true, component: MdxCommentElement } });
export const MdxInlineCommentPlugin = createPlatePlugin({
  key: DOCS_KEYS.mdxInlineComment,
  node: { isElement: true, isInline: true, isVoid: true, component: MdxInlineCommentElement },
});
/** Our own image block (replaces @platejs/media, which pulls an upload server). Same `img` key, so Plate's Markdown rule applies. */
export const ImagePlugin = createPlatePlugin({ key: KEYS.img, node: { isElement: true, isVoid: true, component: ImageElement } });

export const DocsNodesKit = [
  MdxInlineCommentPlugin,
  ModelViewerPlugin,
  FbxViewerPlugin,
  TabsPlugin,
  TabItemPlugin,
  JsxVoidPlugin,
  JsxContainerPlugin,
  OkfGeneratedPlugin,
  MdxCommentPlugin,
  ImagePlugin,
  CalloutPlugin.withComponent(CalloutElement),
];
