// MDX JSX attributes <-> props on a Plate node. No React and no Plate here.
import type { MdxJsxAttribute, MdxJsxExpressionAttribute } from 'mdast-util-mdx-jsx';

/**
 * A prop value on a Plate node:
 * - string           -> `name="value"`
 * - number           -> `name={400}`
 * - true             -> bare `name`
 * - { expression }   -> `name={...}` (any other expression, kept as written)
 */
export type JsxPropValue = string | number | true | { expression: string };

export type JsxAttribute = MdxJsxAttribute | MdxJsxExpressionAttribute;

/** Props read from a JSX element, ready to spread onto a Plate node. */
export interface JsxNodeProps {
  /** Attribute names in file order. `#extraN` points into `extraAttributes`. */
  attrOrder: string[];
  /** Unknown attributes and spreads, kept verbatim. */
  extraAttributes?: JsxAttribute[];
  [prop: string]: unknown;
}

/** Node keys Slate, Plate or React already use (a `text` key would make Slate see a text leaf). `ref` is the one our viewers have (a git ref). */
const RESERVED: Record<string, string> = { ref: 'gitRef', key: 'jsxKey', type: 'jsxType', text: 'jsxText', children: 'jsxChildren', id: 'jsxId' };

/** The Plate node key for a JSX prop name. */
export const toNodeKey = (attr: string): string => RESERVED[attr] ?? attr;

const NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;

/** Drop parser-only data (positions, estree) so the node holds plain JSON. */
function plain(a: JsxAttribute): JsxAttribute {
  if (a.type === 'mdxJsxExpressionAttribute') return { type: a.type, value: a.value };
  const v = a.value;
  return { type: a.type, name: a.name, value: v && typeof v === 'object' ? { type: v.type, value: v.value } : v ?? null };
}

/** Read MDX JSX attributes into node props. Unknown attributes and spreads go into `extraAttributes`. */
export function readJsxAttributes(attributes: readonly JsxAttribute[] | undefined, known: readonly string[]): JsxNodeProps {
  const props: Record<string, JsxPropValue> = {};
  const extraAttributes: JsxAttribute[] = [];
  const attrOrder: string[] = [];
  for (const a of attributes ?? []) {
    if (a.type !== 'mdxJsxAttribute' || !known.includes(a.name)) {
      extraAttributes.push(plain(a));
      attrOrder.push(`#extra${extraAttributes.length - 1}`);
      continue;
    }
    const raw = a.value;
    let v: JsxPropValue;
    if (raw === null || raw === undefined) v = true;
    else if (typeof raw === 'object') v = NUMBER.test(raw.value) ? Number(raw.value) : { expression: raw.value };
    else v = raw;
    props[toNodeKey(a.name)] = v;
    attrOrder.push(a.name);
  }
  return { ...props, ...(extraAttributes.length ? { extraAttributes } : {}), attrOrder };
}

/** `keepEmpty`: the file had this attribute, so `alt=""` is written back (the editor removes a cleared prop instead). */
function attrFor(name: string, v: unknown, keepEmpty: boolean): MdxJsxAttribute | null {
  if (v === undefined || v === null || v === false || (v === '' && !keepEmpty)) return null;
  if (v === true) return { type: 'mdxJsxAttribute', name, value: null };
  if (typeof v === 'number') return { type: 'mdxJsxAttribute', name, value: { type: 'mdxJsxAttributeValueExpression', value: String(v) } };
  if (typeof v === 'object' && 'expression' in v) {
    return { type: 'mdxJsxAttribute', name, value: { type: 'mdxJsxAttributeValueExpression', value: String((v as { expression: unknown }).expression) } };
  }
  return { type: 'mdxJsxAttribute', name, value: String(v) };
}

/**
 * The file order with every known prop the file did not have slotted in by manifest order: right after the
 * last prop that comes before it in the manifest, else before the first known prop. So the props read from
 * the file keep their order, and a prop added in the editor lands where the previous editor wrote it
 * (src, repo, ref, path, alt, height).
 */
export function attributeOrder(order: readonly string[], known: readonly string[]): string[] {
  const out = [...order];
  for (const name of known) {
    if (out.includes(name)) continue;
    const rank = known.indexOf(name);
    let after = -1;
    out.forEach((n, i) => { const r = known.indexOf(n); if (r !== -1 && r < rank) after = i; });
    const first = out.findIndex((n) => known.includes(n));
    out.splice(after !== -1 ? after + 1 : first !== -1 ? first : out.length, 0, name);
  }
  return out;
}

/** Write node props back as MDX JSX attributes, in `attributeOrder`. Empty props are left out, unless the file had them (`alt=""`). */
export function writeJsxAttributes(node: Readonly<Record<string, unknown>>, known: readonly string[]): JsxAttribute[] {
  const out: JsxAttribute[] = [];
  const done = new Set<string>();
  const extras = Array.isArray(node.extraAttributes) ? (node.extraAttributes as JsxAttribute[]) : [];
  const order = Array.isArray(node.attrOrder) ? (node.attrOrder as string[]) : [];
  for (const name of attributeOrder(order, known)) {
    if (done.has(name)) continue;
    done.add(name);
    if (name.startsWith('#extra')) {
      const extra = extras[Number(name.slice(6))];
      if (extra) out.push(extra);
      continue;
    }
    const a = attrFor(name, node[toNodeKey(name)], order.includes(name));
    if (a) out.push(a);
  }
  return out;
}
