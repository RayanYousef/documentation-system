// Markdown rules for the MDX components listed in site/components.json.
// The Plate element types are fixed (see nodes/keys.ts); the manifest decides which tag maps to which
// type and the known prop order. Every JSX node stores its tag as `jsxName`.
import { convertChildrenDeserialize, convertNodesSerialize, type DeserializeMdOptions, type MdDecoration, type MdRules, type SerializeMdOptions } from '@platejs/markdown';
import type { TElement } from 'platejs';
import type { ComponentDescriptor, ComponentsManifest } from '@platform/contracts';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { RootContent } from 'mdast';
import { DOCS_KEYS, type DocsJsxType } from '../nodes/keys.js';
import { readJsxAttributes, writeJsxAttributes } from './jsxAttributes.js';

const PREVIEW_TYPE: Record<Exclude<ComponentDescriptor['preview'], 'generic'>, DocsJsxType> = {
  'model-viewer': DOCS_KEYS.modelViewer,
  'fbx-viewer': DOCS_KEYS.fbxViewer,
  tabs: DOCS_KEYS.tabs,
  'tab-item': DOCS_KEYS.tabItem,
};

/** The Plate type a manifest entry is edited as. Unknown previews fall back to the generic blocks. */
export function jsxTypeFor(c: ComponentDescriptor): DocsJsxType {
  return (c.preview !== 'generic' ? PREVIEW_TYPE[c.preview] : undefined) ?? (c.hasChildren ? DOCS_KEYS.jsxContainer : DOCS_KEYS.jsxVoid);
}

/** The manifest entry a node was made from: by its tag (`jsxName`), else the first entry edited as its type. */
export function descriptorFor(manifest: ComponentsManifest, node: { type: string; jsxName?: unknown }): ComponentDescriptor | undefined {
  const named = typeof node.jsxName === 'string' ? manifest.components.find((c) => c.name === node.jsxName) : undefined;
  return named ?? manifest.components.find((c) => jsxTypeFor(c) === node.type);
}

/** Block types whose children are editable Markdown blocks. */
export const isContainerType = (type: string): boolean =>
  type === DOCS_KEYS.tabs || type === DOCS_KEYS.tabItem || type === DOCS_KEYS.jsxContainer;

/** Tag names the manifest knows: which of them are void (no children allowed), tab groups and tab items. */
export function componentTags(manifest: ComponentsManifest): { flow: Set<string>; voids: Set<string>; tabs: Set<string>; tabItems: Set<string> } {
  const flow = new Set<string>();
  const voids = new Set<string>();
  const tabs = new Set<string>();
  const tabItems = new Set<string>();
  for (const c of manifest.components) {
    const type = jsxTypeFor(c);
    flow.add(c.name);
    if (!isContainerType(type)) voids.add(c.name);
    if (type === DOCS_KEYS.tabs) tabs.add(c.name);
    if (type === DOCS_KEYS.tabItem) tabItems.add(c.name);
  }
  return { flow, voids, tabs, tabItems };
}

/** One `<!-- x -->` comment and nothing else (a generated okf block holds several, and is left alone). */
const HTML_COMMENT = /^<!--((?:(?!-->)[\s\S])*)-->$/;
/** mdast parents whose children are inline (phrasing) content. */
const PHRASING_PARENTS = new Set(['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'tableCell', 'mdxJsxTextElement']);

interface MdastNode { type: string; value?: unknown; children?: MdastNode[] }

/**
 * Inside a component an HTML comment is not valid MDX: the export indents the component's content, so the
 * comment is no longer read as HTML and the MDX parser fails on `<!`. Write each one as an MDX comment,
 * `{/* x *\/}`, instead. A block comment becomes a flow expression, an inline one a text expression.
 */
export function commentsToExpressions<T extends MdastNode>(nodes: readonly T[], parentType: string): T[] {
  return nodes.map((n) => {
    const m = n.type === 'html' && typeof n.value === 'string' ? HTML_COMMENT.exec(n.value.trim()) : null;
    if (m) return { type: PHRASING_PARENTS.has(parentType) ? 'mdxTextExpression' : 'mdxFlowExpression', value: `/*${m[1]}*/` } as unknown as T;
    return n.children ? { ...n, children: commentsToExpressions(n.children, n.type) } : n;
  });
}

const JSX_TYPES: readonly DocsJsxType[] =[DOCS_KEYS.modelViewer, DOCS_KEYS.fbxViewer, DOCS_KEYS.tabs, DOCS_KEYS.tabItem, DOCS_KEYS.jsxVoid, DOCS_KEYS.jsxContainer];

export function componentRules(manifest: ComponentsManifest): MdRules {
  const props = new Map(manifest.components.map((c) => [c.name, c.props.map((p) => p.name)]));
  const defaultTag = new Map<string, string>();
  const rules: MdRules = {};

  for (const c of manifest.components) {
    const type = jsxTypeFor(c);
    const known = props.get(c.name) ?? [];
    if (!defaultTag.has(type)) defaultTag.set(type, c.name);
    rules[c.name] = {
      deserialize: (mdastNode: MdxJsxFlowElement, deco: MdDecoration, options: DeserializeMdOptions): TElement => ({
        type,
        jsxName: c.name,
        ...readJsxAttributes(mdastNode.attributes, known),
        children: isContainerType(type) ? convertChildrenDeserialize(mdastNode.children as RootContent[], deco, options) : [{ text: '' }],
      }),
    };
  }

  for (const type of JSX_TYPES) {
    rules[type] = {
      serialize: (node: TElement, options: SerializeMdOptions): MdxJsxFlowElement => {
        const name = typeof node.jsxName === 'string' ? node.jsxName : defaultTag.get(type) ?? 'Unknown';
        return {
          type: 'mdxJsxFlowElement',
          name,
          attributes: writeJsxAttributes(node, props.get(name) ?? []),
          children: isContainerType(type)
            ? commentsToExpressions(convertNodesSerialize(node.children, options) as MdxJsxFlowElement['children'], 'mdxJsxFlowElement')
            : [],
        };
      },
    };
  }
  return rules;
}
