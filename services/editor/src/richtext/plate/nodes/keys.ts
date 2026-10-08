/** Plate node types for our own blocks. The Markdown mapping (tag <-> type) comes from the components manifest. */
export const DOCS_KEYS = {
  modelViewer: 'model_viewer',
  fbxViewer: 'fbx_viewer',
  tabs: 'tabs',
  tabItem: 'tab_item',
  /** Manifest component with preview `generic` and no children. */
  jsxVoid: 'jsx_void',
  /** Manifest component with preview `generic` and children. */
  jsxContainer: 'jsx_container',
  /** `<!-- okf:* -->` ... `<!-- /okf:* -->`: generated, read-only, written back byte-exact. */
  okfGenerated: 'okf_generated',
  mdxComment: 'mdx_comment',
  mdxInlineComment: 'mdx_inline_comment',
} as const;

export type DocsJsxType = (typeof DOCS_KEYS)['modelViewer' | 'fbxViewer' | 'tabs' | 'tabItem' | 'jsxVoid' | 'jsxContainer'];
