import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { splitDocument } from '../../../frontmatter/yamlDoc.js';
import { buildDocsMarkdown, prepareBody } from './docsMarkdown.js';
import { findUnsupported } from './supportedSyntax.js';

const { tags } = buildDocsMarkdown(DEFAULT_COMPONENTS);
const check = (body: string) => findUnsupported(prepareBody(body), tags);

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, '../../../../../../site/docs');
const FIXTURES = join(HERE, '__fixtures__');
const listMd = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? listMd(p) : n.endsWith('.md') ? [p] : [];
});

describe('findUnsupported', () => {
  it.each([
    ['an import line', "import X from 'y'\n\nText.\n"],
    ['an unknown JSX tag', '<Foo />\n'],
    ['a footnote', 'Text[^1].\n\n[^1]: The note.\n'],
    ['a JS expression', 'Sum: {1+1}\n'],
    ['a reference link', 'See [docs][d].\n\n[d]: https://example.com\n'],
    ['an unclosed viewer tag', '## Title\n\n<FbxViewer repo="a/b" path="x.fbx"\n\nMore text.\n'],
    ['a viewer inside a paragraph', 'text <ModelViewer src="/a.glb" /> text\n'],
    ['a soft line break', 'line one\nline two\n'],
    ['a soft line break inside a list item', '* item one\n  continued\n'],
    ['a void component with children', '<ModelViewer src="/a.glb">\n  x\n</ModelViewer>\n'],
    // Images: Plate's image is a block, so only a paragraph that holds just the image is safe.
    ['an image inside a link', '[![alt](/i.png)](https://x.y)\n'],
    ['a badge (image link) inside text', 'Intro [![build](/b.svg)](https://ci) text after.\n'],
    ['an image in a heading', '## ![i](/x.png) Title\n'],
    ['an image in a list item', '- ![i](/x.png)\n'],
    ['an image inside text', 'Text ![alt](/img.png) more.\n'],
    // List items: one paragraph, then only nested lists.
    ['a code fence inside a list item', '1. Install:\n\n   ```bash\n   npm ci\n   ```\n2. Build it.\n'],
    ['a second paragraph in a list item', '- a\n\n  second para\n- b\n'],
    ['a quote in a list item', '- item\n\n  > quoted\n'],
    ['a table in a list item', '- item\n\n  | a |\n  |---|\n  | b |\n'],
    ['a viewer in a list item', '- item\n\n  <ModelViewer src="/a.glb" />\n'],
    ['a paragraph after a nested list', '- a\n  - b\n\n  after\n'],
    ['an okf block inside a list item', '- x\n\n  <!-- okf:index -->\n  * y\n  <!-- /okf:index -->\n'],
    ['a fence in a quoted list', '> - a\n>\n>   ```js\n>   x\n>   ```\n'],
    ['a heading in a list item', '- # h\n'],
    // Links, comments and smaller losses.
    ['a link title', 'See [docs](https://x.y "Docs title").\n'],
    ['formatting in an admonition title', ':::tip[My **bold** title]\nhello\n:::\n'],
    ['inline code over two lines', 'Run `a\nb` now.\n'],
    ['two bulleted lists next to each other', '- a\n- b\n\n* c\n* d\n'],
    ['two numbered lists next to each other', '1. a\n\n1) b\n'],
    ['a list starting at 0', '0. zero\n'],
    ['a to-do item in a numbered list', '1. [ ] a\n'],
    ['underline with attributes', '<u className="x">under</u>\n'],
    ['a tab item outside tabs', '<TabItem value="a">\n\nx\n\n</TabItem>\n'],
    ['text directly inside tabs', '<Tabs>\n\nloose text\n\n</Tabs>\n'],
    ['a leaf directive', '::youtube[Video]{id=abc}\n'],
    ['a text directive with attributes', 'see :abbr[HTML]{title="Hyper"} now\n'],
    ['a <br> outside a table', 'a<br/>b\n'],
    ['a <br> with attributes in a table', '| a<br class="x"/>b |\n|---|\n| c |\n'],
    // The old Docusaurus title form. remark-directive reads it as plain paragraphs, and the export would
    // escape them as "\:::", so the admonition would vanish from the site after the first edit.
    ['an old-form admonition title (":::note Title" with blank lines)', '\n:::note My Title\n\nbody\n\n:::\n'],
    ['an old-form admonition title after a heading', '\n## Setup\n\n:::warning Before you start\n\nBack up your save files.\n\n:::\n\nLAST paragraph.\n'],
    ['a stray ":::" line', 'Text.\n\n:::\n'],
  ])('rejects %s', (_label, body) => {
    expect(check(body).length).toBeGreaterThan(0);
  });

  it.each([
    ['HTML comments', '<!-- a comment -->\n\nText with an inline <!-- note --> comment.\n'],
    ['underline', 'Some <u>underlined</u> text.\n'],
    ['a hard line break', 'line one\\\nline two\n'],
    ['code that looks like JSX', 'Inline `<Foo {...x} />` and `{a}`.\n\n```tsx\n<Foo />\n{1 + 1}\n```\n'],
    ['a text directive (site:build)', 'Run it before site:build.\n'],
    ['an empty body', ''],
    ['an image on its own line', '![alt](/img.png "the title")\n'],
    ['an image in a quote and in an admonition', '> ![a](/a.png)\n\n:::note\n![b](/b.png)\n:::\n'],
    ['an image in a table cell', '| a |\n|---|\n| ![i](/i.png) |\n'],
    ['a nested list', '- a\n  - b\n- c\n'],
    ['a to-do list', '* [ ] a\n* [x] b\n'],
    ['lists of different kinds next to each other', '* a\n\n1. b\n\n* [ ] c\n'],
    ['a <br> in a table cell', '| a<br/>second | b |\n|---|---|\n| c | d |\n'],
    ['a plain admonition title', ':::tip[My title]\nhello\n:::\n'],
    ['admonitions with blank lines inside', ':::note\n\nbody\n\n:::\n\n:::tip[Title]\n\nbody\n\n:::\n'],
    ['an escaped ":::" in text (writes back the same way)', '\\:::note not an admonition\n'],
    ['":::" later in a paragraph', 'Write :::note to open a note.\n'],
    ['a comment in a quote and in an admonition', '> <!-- c -->\n> text\n\n:::note\n<!-- d -->\n\nx\n:::\n'],
    ['a link without a title', 'See [docs](https://x.y).\n'],
    // A comment inside a component: the export writes it as {/* c */} (see componentRules.test.ts).
    ['an HTML comment inside a tab', '<Tabs>\n<TabItem value="a">\n\n<!-- c -->\n\nx\n\n</TabItem>\n</Tabs>\n'],
    ['an inline HTML comment inside a tab', '<Tabs>\n<TabItem value="a">\n\nx <!-- c --> y\n\n</TabItem>\n</Tabs>\n'],
    ['an MDX comment inside a tab', '<Tabs>\n  <TabItem value="a">\n    {/* c */}\n\n    x {/* d */} y\n  </TabItem>\n</Tabs>\n'],
  ])('accepts %s', (_label, body) => {
    expect(check(body)).toEqual([]);
  });

  it('accepts every page under site/docs and both fixtures', () => {
    const files = [...listMd(DOCS), join(FIXTURES, 'tabs-fixture.md'), join(FIXTURES, 'constructs-fixture.md')];
    expect(files.length).toBeGreaterThan(30);
    const found = files.map((f) => ({ f, errors: check(splitDocument(readFileSync(f, 'utf8')).body) })).filter((x) => x.errors.length);
    expect(found).toEqual([]);
  });
});
