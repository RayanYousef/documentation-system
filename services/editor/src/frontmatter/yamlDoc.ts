import { parseDocument, isSeq, Document } from 'yaml';

export interface FrontmatterFields { title: string; description: string; type: string; tags: string[]; resource: string; sidebar_position: number | null }

const FENCE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitDocument(text: string): { head: string; body: string; hasFrontmatter: boolean } {
  const m = text.match(FENCE);
  if (!m) return { head: '', body: text, hasFrontmatter: false };
  return { head: m[1]!, body: text.slice(m[0].length), hasFrontmatter: true };
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export function readFields(head: string): FrontmatterFields {
  const doc = parseDocument(head || '{}');
  const get = (k: string): unknown => doc.get(k, true) instanceof Object && 'toJSON' in (doc.get(k, true) as object) ? (doc.get(k, true) as { toJSON(): unknown }).toJSON() : doc.get(k);
  const tags = get('tags');
  const pos = get('sidebar_position');
  return {
    title: str(get('title')), description: str(get('description')), type: str(get('type')),
    tags: Array.isArray(tags) ? tags.map(str) : [], resource: str(get('resource')),
    sidebar_position: typeof pos === 'number' ? pos : pos === undefined || pos === null || pos === '' ? null : Number(pos),
  };
}

const sameValue = (a: unknown, b: unknown): boolean =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => x === b[i]) : a === b;

/**
 * Rewrite only the keys whose value changed; untouched lines, comments, quoting and scalar types survive.
 * When no value changed the text comes back byte for byte, so saving an untouched page does not rewrite it.
 */
export function applyFields(text: string, fields: Partial<FrontmatterFields>): string {
  const { head, body, hasFrontmatter } = splitDocument(text);
  const current: Partial<FrontmatterFields> = hasFrontmatter ? readFields(head) : {};
  const changed = Object.entries(fields).filter(([k, v]) => v !== undefined && !(hasFrontmatter && sameValue(current[k as keyof FrontmatterFields], v)));
  if (hasFrontmatter && changed.length === 0) return text;
  const doc: Document = hasFrontmatter ? parseDocument(head) : new Document({});
  for (const [k, v] of changed) {
    if (v === null || (Array.isArray(v) && v.length === 0 && k === 'tags' && !doc.has(k))) { if (doc.has(k)) doc.delete(k); continue; }
    if (Array.isArray(v)) {
      // Keep the list style the author used: `tags: [a, b]` stays a flow list instead of becoming a block list.
      const prev = doc.get(k, true);
      doc.set(k, doc.createNode(v, { flow: isSeq(prev) ? prev.flow === true : true }));
      continue;
    }
    doc.set(k, v);
  }
  // lineWidth: 0 disables folding: okf-core's parseYamlSubset reads only the first physical line of a scalar,
  // so a folded description would silently truncate index.md / manifest.json / log.md.
  // flowCollectionPadding: false writes `[a, b]`, the style the pages use (the library default is `[ a, b ]`).
  const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).replace(/\n$/, '');
  return `---\n${yaml}\n---\n${body}`;
}
