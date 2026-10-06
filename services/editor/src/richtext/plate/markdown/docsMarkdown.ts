// Docs Markdown <-> Plate rules for our pages. No React here.
// Ported from the Plate spike (src/docs/markdown/docs-markdown.ts), which round-trips every page.
//
// What it adds on top of @platejs/markdown:
// - Manifest components (ModelViewer, FbxViewer, Tabs, TabItem, generic): see componentRules.ts.
// - <!-- okf:* --> ... <!-- /okf:* -->: kept byte-exact as one read-only block.
// - Other <!-- comments -->: kept as hidden blocks.
// - :::note (and tip/info/caution/danger) admonitions: Plate callout.
// - Accidental text directives like `site:build`: kept as plain text.
// - GFM table column alignment and code fence meta (```ts title="x") kept.
import { MarkdownPlugin, convertChildrenDeserialize, convertNodesSerialize, defaultRules, remarkMdx, type DeserializeMdOptions, type MdDecoration, type MdRules, type SerializeMdOptions } from '@platejs/markdown';
import type { SlateEditor, TElement, Value } from 'platejs';
import type { ComponentsManifest } from '@platform/contracts';
import type { Code, Paragraph, RootContent, Table } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified, type PluggableList, type Processor } from 'unified';
import { DOCS_KEYS } from '../nodes/keys.js';
import { contentCompare } from './compareMarkdown.js';
import { componentRules, componentTags } from './componentRules.js';
import { findUnsupported, type SupportedTags } from './supportedSyntax.js';

// ---------- generated okf blocks (kept byte-exact) ----------
const OKF_BLOCK = /<!-- okf:index -->[\s\S]*?<!-- \/okf:index -->/g;
// Any generated pair: <!-- okf:index --> ... <!-- /okf:index -->, <!-- okf:codemap --> ... <!-- /okf:codemap -->
const OKF_START = /^<!-- okf:([a-z-]+) -->$/;
export const OKF_TAG = 'OkfGenerated';
const COMMENT = /^<!--([\s\S]*?)-->$/;
const JS_COMMENT = /^\s*\/\*([\s\S]*)\*\/\s*$/;

const toBase64 = (s: string) => {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
};
const fromBase64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

// Plain CommonMark parser, used only to find HTML comments with exact positions.
// It knows code spans and fences, so comments shown inside code are never touched.
const locateParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

interface LocNode { type: string; value?: string; children?: LocNode[]; position?: { start: { offset?: number }; end: { offset?: number } } }
interface Edit { start: number; end: number; text: string }
const start = (n: LocNode) => n.position?.start.offset ?? 0;
const end = (n: LocNode) => n.position?.end.offset ?? 0;

/**
 * Get the body ready for Plate's MDX parser. We call Plate with `withoutMdx: true`, because Plate's
 * own `htmlToJsx` pre-pass rewrites tags everywhere, even inside inline code and code fences.
 * Instead we do the one thing we need:
 * - each `<!-- okf:x -->` ... `<!-- /okf:x -->` block -> one `<OkfGenerated raw="base64" />` line
 * - any other HTML comment outside code -> an MDX comment expression
 */
export function prepareBody(body: string): string {
  const tree = locateParser.parse(body) as LocNode;
  const edits: Edit[] = [];
  const kids = tree.children ?? [];
  const inOkf = new Set<LocNode>();
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]!;
    const marker = n.type === 'html' ? OKF_START.exec((n.value ?? '').trim()) : null;
    if (!marker) continue;
    const endMarker = `<!-- /okf:${marker[1]} -->`;
    const j = kids.findIndex((m, k) => k > i && m.type === 'html' && (m.value ?? '').trim() === endMarker);
    if (j < 0) continue;
    const from = start(n);
    const to = end(kids[j]!);
    edits.push({ start: from, end: to, text: `<${OKF_TAG} raw="${toBase64(body.slice(from, to))}" />` });
    for (let k = i; k <= j; k++) inOkf.add(kids[k]!);
    i = j;
  }
  const walk = (node: LocNode) => {
    if (inOkf.has(node)) return;
    const m = node.type === 'html' ? COMMENT.exec((node.value ?? '').trim()) : null;
    if (m) {
      edits.push({ start: start(node), end: end(node), text: `{/*${m[1]}*/}` });
      return;
    }
    for (const c of node.children ?? []) walk(c);
  };
  walk(tree);
  edits.sort((a, b) => b.start - a.start);
  let out = body;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

interface StringifyExtension { handlers?: Record<string, unknown>; unsafe?: { character: string; before?: string }[] }

/**
 * remark-directive escapes `site:build` as `site\:build` on output (so it is not read as a directive).
 * Our pages write it unescaped and Docusaurus shows it as text, so keep it as written.
 * Must run after remark-directive.
 */
export function remarkKeepTextColons(this: Processor) {
  const data = this.data() as { toMarkdownExtensions?: StringifyExtension[] };
  data.toMarkdownExtensions = (data.toMarkdownExtensions ?? []).map((ext) =>
    ext?.handlers?.textDirective && Array.isArray(ext.unsafe)
      ? { ...ext, unsafe: ext.unsafe.filter((u) => !(u.character === ':' && u.before === '[^:]')) }
      : ext,
  );
}

/** Pages write table delimiter rows as `|---|---|`. remark writes `| - | - |`. Put the compact form back (keeps `:` alignment). */
export function compactTableDelimiters(md: string): string {
  let inFence = false;
  return md
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      const m = /^(\s*)(\|( *:?-+:? *\|)+)$/.exec(line);
      if (inFence || !m) return line;
      const row = m[2]!;
      return `${m[1]}|${row.slice(1, -1).split('|').map((c) => {
        const t = c.trim();
        return `${t.startsWith(':') ? ':' : ''}---${t.endsWith(':') && t.length > 1 ? ':' : ''}`;
      }).join('|')}|`;
    })
    .join('\n');
}

// ---------- bullet marker ----------
export type Bullet = '*' | '-' | '+';

/** Pages use either `*` or `-`, never both. Keep the page's own marker. Default `*` (what the previous editor wrote). */
export function detectBulletMarker(body: string): Bullet {
  let inFence = false;
  for (const line of body.replace(OKF_BLOCK, '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^ {0,3}([*+-])[ \t]+\S/.exec(line);
    if (m && !/^ {0,3}([*-])\s*\1\s*\1[\s*-]*$/.test(line)) return m[1] as Bullet;
  }
  return '*';
}

// ---------- the rules ----------
/** remark-directive node (local shape, so we do not depend on mdast-util-directive directly). */
interface DirectiveNode { name: string; attributes?: Record<string, string | null | undefined> | null; children: RootContent[] }
/** MDX expression node (remark-mdx). */
interface ExpressionNode { value: string }

interface WithChildren { children?: readonly unknown[] }
const flatText = (nodes: readonly unknown[] = []): string =>
  nodes.map((c) => {
    const n = c as { value?: unknown } & WithChildren;
    return typeof n.value === 'string' ? n.value : flatText(n.children);
  }).join('');

const directiveSource = (n: DirectiveNode, prefix: string) => {
  const label = n.children?.length ? `[${flatText(n.children)}]` : '';
  const attrs = n.attributes && Object.keys(n.attributes).length
    ? `{${Object.entries(n.attributes).map(([k, v]) => (v === '' ? k : `${k}="${v ?? ''}"`)).join(' ')}}`
    : '';
  return `${prefix}${n.name}${label}${attrs}`;
};

const commentOut = (value: unknown, fallback: 'mdxFlowExpression' | 'mdxTextExpression') => {
  const m = JS_COMMENT.exec(typeof value === 'string' ? value : '');
  return m ? { type: 'html', value: `<!--${m[1]}-->` } : { type: fallback, value: String(value ?? '') };
};

const defaults = defaultRules as Required<Pick<MdRules, 'a' | 'table'>>;

/** Rules that do not depend on the components manifest. */
export const staticDocsRules: MdRules = {
  // generated okf block: opaque, read-only, written back byte-exact
  [OKF_TAG]: {
    deserialize: (mdastNode: MdxJsxFlowElement): TElement => {
      const rawAttr = mdastNode.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'raw');
      return { type: DOCS_KEYS.okfGenerated, raw: fromBase64(typeof rawAttr?.value === 'string' ? rawAttr.value : ''), children: [{ text: '' }] };
    },
  },
  [DOCS_KEYS.okfGenerated]: { serialize: (node: TElement) => ({ type: 'html', value: String(node.raw ?? '') }) },

  // any other <!-- comment -->. prepareBody turns it into {/* comment */} before parsing.
  mdxFlowExpression: {
    deserialize: (mdastNode: ExpressionNode): TElement => ({ type: DOCS_KEYS.mdxComment, value: mdastNode.value, children: [{ text: '' }] }),
  },
  [DOCS_KEYS.mdxComment]: { serialize: (node: TElement) => commentOut(node.value, 'mdxFlowExpression') },

  // inline <!-- comment --> inside a paragraph
  mdxTextExpression: {
    deserialize: (mdastNode: ExpressionNode): TElement => ({ type: DOCS_KEYS.mdxInlineComment, value: mdastNode.value, children: [{ text: '' }] }),
  },
  [DOCS_KEYS.mdxInlineComment]: { serialize: (node: TElement) => commentOut(node.value, 'mdxTextExpression') },

  // Links never use the `<url>` form: MDX reads `<a@b.co>` or `<tel:123>` as a broken JSX tag, and the
  // site build fails. STRINGIFY sets `resourceLink`, so remark always writes `[text](url)`. Plate's own rule
  // still sees `resourceLink: false`, so a bare http(s) URL stays bare text (a GFM autolink), as pages write it.
  a: {
    ...defaults.a,
    serialize: (node, options) =>
      defaults.a.serialize!(node, { ...options, remarkStringifyOptions: { ...options.remarkStringifyOptions, resourceLink: false } }),
  },

  // GFM table: Plate drops column alignment (|:---|---:|). Keep it on the table node.
  table: {
    deserialize: (mdastNode: Table, deco: MdDecoration, options: DeserializeMdOptions) => ({
      ...defaults.table.deserialize!(mdastNode, deco, options),
      ...(mdastNode.align?.some((a) => a) ? { align: mdastNode.align } : {}),
    }),
    serialize: (node: TElement, options: SerializeMdOptions) => ({
      ...defaults.table.serialize!(node as Parameters<NonNullable<typeof defaults.table.serialize>>[0], options),
      ...(Array.isArray(node.align) ? { align: node.align } : {}),
    }),
  },

  // :::note ... ::: <-> callout (variant = directive name)
  containerDirective: {
    deserialize: (mdastNode: DirectiveNode, deco: MdDecoration, options: DeserializeMdOptions): TElement => {
      const first = mdastNode.children[0] as Paragraph | undefined;
      const label = first?.data && 'directiveLabel' in first.data && first.data.directiveLabel ? first : null;
      const body = label ? mdastNode.children.slice(1) : mdastNode.children;
      return {
        type: 'callout',
        variant: mdastNode.name,
        ...(label ? { title: flatText(label.children) } : {}),
        ...(mdastNode.attributes && Object.keys(mdastNode.attributes).length ? { directiveAttributes: mdastNode.attributes } : {}),
        children: convertChildrenDeserialize(body as RootContent[], deco, options),
      };
    },
  },
  callout: {
    serialize: (node: TElement, options: SerializeMdOptions) => ({
      type: 'containerDirective',
      name: typeof node.variant === 'string' ? node.variant : 'note',
      attributes: node.directiveAttributes ?? {},
      children: [
        ...(node.title
          ? [{ type: 'paragraph', data: { directiveLabel: true }, children: [{ type: 'text', value: String(node.title) }] }]
          : []),
        ...convertNodesSerialize(node.children, options),
      ],
    }),
  },
  // `site:build` in prose parses as a text directive. Keep it as the text the author typed.
  textDirective: {
    deserialize: (mdastNode: DirectiveNode, deco: MdDecoration) => ({ ...deco, text: directiveSource(mdastNode, ':') }),
  },
  leafDirective: {
    deserialize: (mdastNode: DirectiveNode): TElement => ({ type: 'p', children: [{ text: directiveSource(mdastNode, '::') }] }),
  },

  // keep the fence meta (```ts title="x.ts") that the default rule drops; never change `lang`
  code_block: {
    deserialize: (mdastNode: Code, _deco: MdDecoration, options: DeserializeMdOptions): TElement => ({
      type: options.editor?.getType('code_block') ?? 'code_block',
      lang: mdastNode.lang ?? undefined,
      ...(mdastNode.meta ? { meta: mdastNode.meta } : {}),
      children: (mdastNode.value || '').split('\n').map((line) => ({
        type: options.editor?.getType('code_line') ?? 'code_line',
        children: [{ text: line }],
      })),
    }),
    serialize: (node: TElement): Code => ({
      type: 'code',
      lang: typeof node.lang === 'string' ? node.lang : null,
      meta: typeof node.meta === 'string' ? node.meta : null,
      value: node.children
        .map((l) => ('children' in l ? (l.children as { text?: string }[]).map((c) => c.text ?? '').join('') : String((l as { text?: string }).text ?? '')))
        .join('\n'),
    }),
  },
};

/**
 * Same list for import, with an UNTAGGED remark-mdx. Plate's `withoutMdx: true` does two things:
 * it skips the htmlToJsx pre-pass (we want that) and it removes plugins tagged as remarkMdx
 * (we do not). The untagged wrapper keeps MDX parsing on.
 */
function remarkMdxUntagged(this: Processor, ...args: Parameters<typeof remarkMdx>) {
  return remarkMdx.apply(this, args);
}

/** Remark plugins for our pages. Frontmatter is split off before Plate sees the body. */
const docsRemarkPluginList: PluggableList = [[remarkGfm, { tablePipeAlign: false }], remarkDirective, remarkKeepTextColons, remarkMdx];
const docsImportRemarkPluginList: PluggableList = [[remarkGfm, { tablePipeAlign: false }], remarkDirective, remarkMdxUntagged];
// Plate types `remarkPlugins` as Plugin[], but hands the list to unified's `.use()`, which also takes [plugin, options] tuples.
type PlateRemarkPlugins = NonNullable<SerializeMdOptions['remarkPlugins']>;
export const docsRemarkPlugins = docsRemarkPluginList as PlateRemarkPlugins;
export const docsImportRemarkPlugins = docsImportRemarkPluginList as PlateRemarkPlugins;

/**
 * remark-stringify options. Same as the previous editor wrote: one-space list indent. Bullet is set per page.
 * `resourceLink`: always `[text](url)`, never `<url>` (invalid MDX for mailto: and tel:). See the `a` rule.
 */
export const STRINGIFY = { listItemIndent: 'one', emphasis: '*', rule: '-', fence: '`', resourceLink: true } as const;

/** Everything the import and export need for one components manifest. */
export interface DocsMarkdown {
  rules: MdRules;
  tags: SupportedTags;
}

export function buildDocsMarkdown(manifest: ComponentsManifest): DocsMarkdown {
  const { flow, voids, tabs, tabItems } = componentTags(manifest);
  return {
    rules: { ...staticDocsRules, ...componentRules(manifest) },
    // `br`: Plate writes a line break inside a table cell as <br/> (Markdown has no other way), and reads it back.
    tags: { flow: new Set([...flow, OKF_TAG]), voids: new Set([...voids, OKF_TAG]), text: new Set(['u', 'br']), tabs, tabItems },
  };
}

/** The MarkdownPlugin configured for docs pages (paste uses it too). The rules are set per manifest at runtime. */
export const DocsMarkdownPlugin = MarkdownPlugin.configure({
  options: {
    remarkPlugins: docsRemarkPlugins,
    rules: staticDocsRules,
    remarkStringifyOptions: { ...STRINGIFY, bullet: '*' },
  },
});

// ---------- import / export ----------
export interface ImportResult {
  value: Value;
  errors: string[];
  bullet: Bullet;
}

/** Markdown body (no frontmatter) -> Plate value. Any error means: open this page in Raw mode. */
export function importBody(editor: SlateEditor, body: string, md: DocsMarkdown): ImportResult {
  const bullet = detectBulletMarker(body);
  let prepared: string;
  try {
    prepared = prepareBody(body);
  } catch (e) {
    return { value: [], errors: [`prepare: ${(e as Error).message}`], bullet };
  }
  const errors = findUnsupported(prepared, md.tags);
  if (errors.length) return { value: [], errors, bullet };
  // withoutMdx: skip Plate's htmlToJsx pre-pass (see prepareBody).
  const value = editor.getApi(MarkdownPlugin).markdown.deserialize(prepared, {
    withoutMdx: true,
    remarkPlugins: docsImportRemarkPlugins,
    rules: md.rules,
    onError: (e: Error) => errors.push(e?.message ?? String(e)),
  });
  if (value.length === 0 && body.trim() !== '' && errors.length === 0) errors.push('empty result');
  if (errors.length === 0) {
    // Safety net for anything the pre-scan misses: the page must survive import + export with the same content.
    // Otherwise the first edit would rewrite it, and the dirty flag could not tell (its baseline is this export).
    const cmp = contentCompare(prepared, prepareBody(exportBody(editor, value, bullet, md)));
    if (!cmp.equal) errors.push(`The visual editor would change this page: ${cmp.difference ?? 'unknown difference'}`);
  }
  return { value: errors.length ? [] : value, errors, bullet };
}

/**
 * Plate value -> Markdown body. Passes the full rule set on every call (Plate merges it over its defaults).
 * preserveEmptyParagraphs: false, or Plate writes an empty paragraph (an empty table cell, a new quote) as a
 * zero-width space. Markdown has no empty paragraphs, so they are left out instead.
 */
export function exportBody(editor: SlateEditor, value: Value, bullet: Bullet, md: DocsMarkdown): string {
  const out = editor.getApi(MarkdownPlugin).markdown.serialize({
    value,
    rules: md.rules,
    preserveEmptyParagraphs: false,
    remarkStringifyOptions: { ...STRINGIFY, bullet },
  });
  return compactTableDelimiters(out);
}

