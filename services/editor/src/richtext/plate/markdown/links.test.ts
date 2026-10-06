import { describe, it, expect } from 'vitest';
import type { Value } from 'platejs';
import { createPlateEditor } from 'platejs/react';
import { remarkMdx } from '@platejs/markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody, importBody } from './docsMarkdown.js';

// Links must never be written as `<url>`: MDX (and so the Docusaurus build) reads `<a@b.co>` or
// `<tel:123>` as a broken JSX tag. Every export here must parse as MDX and reopen in the visual editor.
const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const mdx = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkMdx);
const fresh = () => createPlateEditor({ plugins: ContentKit });

/** The export must be valid MDX and must open again without errors. */
function expectReopens(out: string) {
  expect(out).not.toMatch(/<[a-z]+:/i);
  expect(out).not.toMatch(/<[^>\s]+@[^>\s]+>/);
  expect(() => mdx.parse(out)).not.toThrow();
  expect(importBody(fresh(), `\n${out}`, md).errors).toEqual([]);
}

function roundTrip(body: string): string {
  const editor = fresh();
  const r = importBody(editor, body, md);
  expect(r.errors).toEqual([]);
  return exportBody(editor, r.value, r.bullet, md);
}

function exportValue(value: Value): string {
  const editor = fresh();
  editor.tf.setValue(value);
  return exportBody(editor, editor.children, '*', md);
}

describe('link export', () => {
  it.each([
    ['a mailto link', 'mail [a@b.co](mailto:a@b.co) now\n', 'mail [a@b.co](mailto:a@b.co) now\n'],
    ['a tel link', 'call [tel:123](tel:123) now\n', 'call [tel:123](tel:123) now\n'],
    ['an ftp link', 'get [ftp://x.y/z](ftp://x.y/z) now\n', 'get [ftp://x.y/z](ftp://x.y/z) now\n'],
    ['a plain email in prose', 'contact a@b.co now\n', 'contact [a@b.co](mailto:a@b.co) now\n'],
    ['an escaped email in prose', 'mail a\\@b.co x\n', null],
    ['a bare https URL', 'see https://x.y now\n', 'see https://x.y now\n'],
    ['a normal link', 'See [docs](https://x.y) and [page](combat.md).\n', 'See [docs](https://x.y) and [page](combat.md).\n'],
  ])('%s round-trips as valid MDX', (_label, body, expected) => {
    const out = roundTrip(body);
    if (expected !== null) expect(out).toBe(expected);
    expectReopens(out);
  });

  it.each([
    ['mailto:a@b.co', 'a@b.co', '[a@b.co](mailto:a@b.co)'],
    ['tel:123', 'tel:123', '[tel:123](tel:123)'],
    ['ftp://x.y/z', 'ftp://x.y/z', '[ftp://x.y/z](ftp://x.y/z)'],
    ['https://x.y/z', 'https://x.y/z', 'https://x.y/z'],
  ])('a link to %s with the text %s (the link toolbar) is written as %s', (url, text, written) => {
    const out = exportValue([{ type: 'p', children: [{ text: 'mail ' }, { type: 'a', url, children: [{ text }] }, { text: ' now' }] }]);
    expect(out).toBe(`mail ${written} now\n`);
    expectReopens(out);
  });

  it('an email typed into a paragraph is saved so the page opens again', () => {
    const editor = fresh();
    const r = importBody(editor, 'start\n', md);
    editor.tf.setValue(r.value);
    editor.tf.select(editor.api.end([0]));
    for (const t of [' mail a@b.co', ' ', 'x']) editor.tf.insertText(t);
    const out = exportBody(editor, editor.children, r.bullet, md);
    // Plain text: remark escapes the @ so it is not read as a link. Opening it again reads a mailto link.
    expect(out).toBe('start mail a\\@b.co x\n');
    expectReopens(out);
  });
});
