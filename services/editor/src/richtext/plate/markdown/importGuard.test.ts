// The round-trip guard at the end of importBody: a page that the editor would change goes to Raw,
// even when the pre-scan (supportedSyntax.ts) lets it through.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlateEditor } from 'platejs/react';
import type { MdRules } from '@platejs/markdown';
import type { ComponentsManifest } from '@platform/contracts';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody, importBody, type DocsMarkdown } from './docsMarkdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, '../../../../../../site/components.json'), 'utf8')) as ComponentsManifest;
const md = buildDocsMarkdown(manifest);
const load = (body: string, m: DocsMarkdown = md) => importBody(createPlateEditor({ plugins: ContentKit }), body, m);

describe('importBody round-trip guard', () => {
  it('sends a page to Raw when the export would lose content the pre-scan allowed', () => {
    // A broken callout writer that drops the admonition title: the pre-scan cannot know, the guard does.
    const lossy: MdRules = {
      ...md.rules,
      callout: {
        serialize: (node, options) => md.rules.callout!.serialize!({ ...node, title: undefined }, options),
      },
    };
    const r = load('\n:::tip[My title]\nhello\n:::\n', { ...md, rules: lossy });
    expect(r.value).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^The visual editor would change this page: /);
  });

  it.each([
    ['an image on its own line', '\n![alt](/img.png "the title")\n'],
    ['an image in a quote and an admonition', '\n> ![a](/a.png)\n\n:::note\n![b](/b.png)\n:::\n'],
    ['an image in a table cell', '\n| a |\n|---|\n| ![i](/i.png) |\n'],
    ['lists of different kinds next to each other', '\n* a\n\n1. b\n\n* [ ] c\n'],
    ['a <br> in a table cell', '\n| a<br/>second | b |\n|---|---|\n| c | d |\n'],
    ['a comment in a quote and an admonition', '\n> <!-- c -->\n> text\n\n:::note\n<!-- d -->\n\nx\n:::\n'],
    ['an empty alt on a viewer', '\n<ModelViewer src="/a.glb" alt="" />\n'],
  ])('lets a safe page through: %s', (_label, body) => {
    expect(load(body).errors).toEqual([]);
  });

  it('writes back an empty attribute the file had, and drops one the file did not have', () => {
    const editor = createPlateEditor({ plugins: ContentKit });
    const r = importBody(editor, '\n<ModelViewer src="/a.glb" alt="" />\n', md);
    expect(r.errors).toEqual([]);
    expect(exportBody(editor, r.value, r.bullet, md)).toBe('<ModelViewer src="/a.glb" alt="" />\n');
    const fresh = [{ type: r.value[0]!.type, jsxName: 'ModelViewer', src: '/a.glb', alt: '', attrOrder: ['src'], children: [{ text: '' }] }];
    expect(exportBody(editor, fresh, '*', md)).toBe('<ModelViewer src="/a.glb" />\n');
  });
});
