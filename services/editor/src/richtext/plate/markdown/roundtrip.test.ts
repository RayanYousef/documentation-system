// Round-trip: page -> split frontmatter -> Plate value -> Markdown -> compose the page again.
// - Frozen copies in __fixtures__/pages must come back byte for byte (except KNOWN_INEXACT).
// - Live pages under site/docs are only checked for meaning, so a docs-only change cannot break CI:
//   import has no errors, the export is content-equal, and a second pass gives the same text.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlateEditor } from 'platejs/react';
import type { ComponentsManifest } from '@platform/contracts';
import { splitDocument } from '../../../frontmatter/yamlDoc.js';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody, importBody } from './docsMarkdown.js';
import { contentCompare } from './compareMarkdown.js';

// Paths are built with join(): Vite rewrites new URL('./x', import.meta.url) as an asset URL.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../../../../../');
const DOCS = join(REPO, 'site/docs');
const PAGES = join(HERE, '__fixtures__/pages');
const manifest = JSON.parse(readFileSync(join(REPO, 'site/components.json'), 'utf8')) as ComponentsManifest;
const md = buildDocsMarkdown(manifest);

/** Padded inline code `` ` - ` `` is written back as `` `-` ``: same meaning, different bytes. */
const KNOWN_INEXACT = ['platform__okf-core.md'];

const listMd = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listMd(p) : n.endsWith('.md') ? [p] : [];
}).sort();

/** Same as App.compose(): fence + head + fence, then a blank line before the body. */
const compose = (head: string, hasFrontmatter: boolean, body: string) =>
  hasFrontmatter ? `---\n${head}\n---\n${body.startsWith('\n') ? body : `\n${body}`}` : body;

function roundtrip(original: string) {
  const editor = createPlateEditor({ plugins: ContentKit });
  const { head, body, hasFrontmatter } = splitDocument(original);
  const imported = importBody(editor, body, md);
  editor.tf.setValue(imported.value);
  const outBody = exportBody(editor, editor.children, imported.bullet, md);
  const again = importBody(editor, outBody, md);
  return {
    errors: imported.errors,
    body,
    outBody,
    exported: compose(head, hasFrontmatter, outBody),
    stable: exportBody(editor, again.value, again.bullet, md) === outBody,
  };
}

describe('round-trip of frozen page copies (byte-exact)', () => {
  const files = listMd(PAGES);
  it('has frozen copies', () => expect(files.length).toBeGreaterThan(10));
  it.each(files.map((f) => [relative(PAGES, f)]))('%s', (name) => {
    const original = readFileSync(join(PAGES, name), 'utf8');
    const r = roundtrip(original);
    expect(r.errors).toEqual([]);
    if (KNOWN_INEXACT.includes(name)) {
      expect(r.exported).not.toBe(original);
      expect(contentCompare(r.body, r.outBody)).toEqual({ equal: true, difference: null });
    } else {
      expect(r.exported).toBe(original);
    }
    expect(r.stable).toBe(true);
  }, 60_000);
});

describe('round-trip of every live page under site/docs (content-equal)', () => {
  const files = listMd(DOCS);
  it('finds the pages', () => expect(files.length).toBeGreaterThan(30));
  it.each(files.map((f) => [relative(DOCS, f).replace(/\\/g, '/')]))('%s', (name) => {
    const r = roundtrip(readFileSync(join(DOCS, name), 'utf8'));
    expect(r.errors).toEqual([]);
    expect(contentCompare(r.body, r.outBody)).toEqual({ equal: true, difference: null });
    expect(r.stable).toBe(true);
  }, 60_000);
});

describe('the old ":::note Title" admonition form', () => {
  // Docusaurus still renders `:::warning Before you start` as an admonition, but remark-directive reads it
  // as plain paragraphs. The export would write `\:::warning ...`, and the admonition would vanish from
  // the site after the first edit. Such a page must open in Raw mode instead.
  it('is rejected by the import, so the page opens in Raw', () => {
    const body = '\n## Setup\n\n:::warning Before you start\n\nBack up your save files.\n\n:::\n\nLAST paragraph.\n';
    const r = roundtrip(body);
    expect(r.errors.join('\n')).toMatch(/old ":::note Title" form/);
  });

  it('an escaped "\\:::" line is plain text and comes back byte for byte', () => {
    const body = '\\:::note not an admonition\n\nText.\n';
    const r = roundtrip(body);
    expect(r.errors).toEqual([]);
    expect(r.outBody).toBe(body);
  });
});
