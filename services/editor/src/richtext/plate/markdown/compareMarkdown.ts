// Compares two Markdown bodies by meaning ("content equal"), not by bytes.
// Both sides are parsed to mdast and normalised (whitespace, list spread, escapes, positions).
// Used by importBody as the round-trip guard (a page that would change goes to Raw), and by the tests.
// Ported from the Plate spike (roundtrip/compare.ts, contentCompare only).
import { remarkMdx } from '@platejs/markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const mdxParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkMdx);
const mdParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

type Json = { [k: string]: unknown };
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const flatText = (xs: unknown): string =>
  Array.isArray(xs) ? xs.map((c) => (isObj(c) && typeof c.value === 'string' ? c.value : flatText(isObj(c) ? c.children : []))).join('') : '';

/** Normalise an mdast tree so only meaning is compared. */
function normalize(node: unknown): unknown {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const child of node.map(normalize)) {
      const prev = out[out.length - 1];
      // merge adjacent text nodes (escapes and directive-to-text create splits)
      if (isObj(prev) && prev.type === 'text' && isObj(child) && child.type === 'text') prev.value = `${String(prev.value)}${String(child.value)}`;
      else out.push(child);
    }
    for (const n of out) if (isObj(n) && n.type === 'text') n.value = String(n.value).replace(/\s+/g, ' ');
    return out;
  }
  if (!isObj(node)) return node;
  // An unknown text directive (`site:build`) renders as plain text in Docusaurus. Treat it as text.
  if (node.type === 'textDirective' && (!isObj(node.attributes) || Object.keys(node.attributes).length === 0)) {
    return { type: 'text', value: `:${String(node.name)}${Array.isArray(node.children) && node.children.length ? `[${flatText(node.children)}]` : ''}` };
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'position' || k === 'spread') continue;
    if (k === 'data' && node.type !== 'paragraph') continue; // estree data on MDX nodes
    if (k === 'checked' && v == null) continue;
    if (k === 'start' && (v == null || v === 1) && node.type === 'list') continue;
    if (k === 'lang' || k === 'meta') { if (v != null) out[k] = v; continue; }
    if (k === 'value' && node.type === 'html') { out[k] = String(v).trim(); continue; }
    if (k === 'attributes' && Array.isArray(v)) {
      out[k] = v.map((a: unknown) => isObj(a)
        ? { type: a.type, name: a.name, value: isObj(a.value) ? { expression: a.value.value } : a.value }
        : a);
      continue;
    }
    out[k] = normalize(v);
  }
  return out;
}

/** The first path where two normalised trees differ, or null. */
function firstDifference(a: unknown, b: unknown, path = 'root'): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${path}: ${JSON.stringify(a)?.slice(0, 160)} != ${JSON.stringify(b)?.slice(0, 160)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) return `${path}[${i}]: extra in export: ${JSON.stringify(b[i]).slice(0, 200)}`;
      if (i >= b.length) return `${path}[${i}]: missing in export: ${JSON.stringify(a[i]).slice(0, 200)}`;
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const ao = a as Json;
  const bo = b as Json;
  for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    const d = firstDifference(ao[k], bo[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

/**
 * Compare two bodies (no frontmatter). Pages with `<!-- -->` comments cannot be parsed by strict MDX,
 * so those are compared with the plain Markdown parser on both sides.
 */
export function contentCompare(original: string, exported: string): { equal: boolean; difference: string | null } {
  let parser = mdxParser;
  let a: unknown;
  try { a = mdxParser.parse(original); } catch { parser = mdParser; a = mdParser.parse(original); }
  let b: unknown;
  try { b = parser.parse(exported); } catch (e) { return { equal: false, difference: `export does not parse: ${(e as Error).message}` }; }
  const difference = firstDifference(normalize(a), normalize(b));
  return { equal: difference === null, difference };
}
