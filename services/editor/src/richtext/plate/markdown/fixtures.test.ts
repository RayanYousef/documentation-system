// Synthetic pages for constructs no real page uses yet (Tabs, nested viewer, titles, alignment, comments).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Descendant } from 'platejs';
import { createPlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { splitDocument } from '../../../frontmatter/yamlDoc.js';
import { ContentKit } from '../kits/content-kit.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { buildDocsMarkdown, exportBody, importBody } from './docsMarkdown.js';
import { contentCompare } from './compareMarkdown.js';

const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const read = (name: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', name), 'utf8');

function roundtrip(original: string) {
  const editor = createPlateEditor({ plugins: ContentKit });
  const { head, body } = splitDocument(original);
  const imported = importBody(editor, body, md);
  editor.tf.setValue(imported.value);
  const outBody = exportBody(editor, editor.children, imported.bullet, md);
  const again = importBody(editor, outBody, md);
  return {
    imported,
    body,
    outBody,
    exported: `---\n${head}\n---\n${outBody.startsWith('\n') ? outBody : `\n${outBody}`}`,
    stable: exportBody(editor, again.value, again.bullet, md) === outBody,
  };
}

type N = Record<string, unknown> & { type?: string; children?: N[] };
const walk = (nodes: Descendant[] | N[], parent: N | null = null, out: { node: N; parent: N | null }[] = []) => {
  for (const n of nodes as N[]) {
    out.push({ node: n, parent });
    if (Array.isArray(n.children)) walk(n.children, n, out);
  }
  return out;
};

describe('fixtures', () => {
  it('tabs-fixture: content-equal and stable; the only text change is a blank line between TabItems', () => {
    const original = read('tabs-fixture.md');
    const r = roundtrip(original);
    expect(r.imported.errors).toEqual([]);
    expect(contentCompare(r.body, r.outBody).equal).toBe(true);
    expect(r.stable).toBe(true);
    expect(r.exported).toBe(original.replace('  </TabItem>\n  <TabItem value="orange"', '  </TabItem>\n\n  <TabItem value="orange"'));
  });

  it('constructs-fixture: byte-exact and stable', () => {
    const original = read('constructs-fixture.md');
    const r = roundtrip(original);
    expect(r.imported.errors).toEqual([]);
    expect(r.exported).toBe(original);
    expect(r.stable).toBe(true);
  });

  it('builds the expected node types', () => {
    const all = [
      ...walk(roundtrip(read('tabs-fixture.md')).imported.value),
      ...walk(roundtrip(read('constructs-fixture.md')).imported.value),
    ];
    const has = (pred: (x: { node: N; parent: N | null }) => boolean) => all.some(pred);
    expect(has((x) => x.node.type === DOCS_KEYS.tabs)).toBe(true);
    expect(has((x) => x.node.type === DOCS_KEYS.tabItem && x.parent?.type === DOCS_KEYS.tabs)).toBe(true);
    expect(has((x) => x.node.type === DOCS_KEYS.modelViewer && x.parent?.type === DOCS_KEYS.tabItem)).toBe(true);
    expect(has((x) => x.node.type === 'callout' && x.node.variant === 'caution' && x.node.title === 'Watch out')).toBe(true);
    expect(has((x) => x.node.type === 'table' && Array.isArray(x.node.align))).toBe(true);
    expect(has((x) => x.node.type === DOCS_KEYS.mdxComment)).toBe(true);
    expect(has((x) => x.node.type === DOCS_KEYS.mdxInlineComment)).toBe(true);
    expect(has((x) => x.node.type === 'code_block' && x.node.meta === 'title="example.ts"')).toBe(true);
    expect(has((x) => x.node.type === 'img' && x.node.url === '/img/cube.png')).toBe(true);
  });
});
