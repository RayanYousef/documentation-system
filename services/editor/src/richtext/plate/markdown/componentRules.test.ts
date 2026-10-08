import { describe, it, expect } from 'vitest';
import type { TElement } from 'platejs';
import { createPlateEditor } from 'platejs/react';
import type { ComponentsManifest } from '@platform/contracts';
import { remarkMdx } from '@platejs/markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { ContentKit } from '../kits/content-kit.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { buildDocsMarkdown, exportBody, importBody, prepareBody } from './docsMarkdown.js';
import { componentRules } from './componentRules.js';

const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const fresh = () => createPlateEditor({ plugins: ContentKit });
const load = (body: string, m = md) => {
  const editor = fresh();
  const r = importBody(editor, body, m);
  expect(r.errors).toEqual([]);
  editor.tf.setValue(r.value);
  return { editor, r, out: () => exportBody(editor, editor.children, r.bullet, m) };
};
const el = (v: unknown) => v as TElement & Record<string, unknown>;

describe('componentRules', () => {
  it('maps every manifest entry to its Plate type and keeps the tag as jsxName', () => {
    const { editor } = load('<ModelViewer src="/a.glb" />\n\n<FbxViewer src="/b.fbx" />\n\n<Tabs>\n  <TabItem value="a" label="A">\n    x\n  </TabItem>\n</Tabs>\n');
    const [mv, fbx, tabs] = editor.children.map(el);
    expect(mv).toMatchObject({ type: DOCS_KEYS.modelViewer, jsxName: 'ModelViewer', src: '/a.glb' });
    expect(fbx).toMatchObject({ type: DOCS_KEYS.fbxViewer, jsxName: 'FbxViewer', src: '/b.fbx' });
    expect(tabs).toMatchObject({ type: DOCS_KEYS.tabs, jsxName: 'Tabs' });
    expect(el(tabs!.children[0])).toMatchObject({ type: DOCS_KEYS.tabItem, jsxName: 'TabItem', value: 'a', label: 'A' });
  });

  it('keeps unknown props and spreads verbatim, in place', () => {
    const body = '<ModelViewer src="/m.glb" autoRotate data-x="1" height={320} {...rest} />\n';
    expect(load(body).out()).toBe(body);
  });

  it('stores ref as gitRef and writes it back as ref', () => {
    const body = '<FbxViewer repo="o/r" ref="main" path="a.fbx" />\n';
    const { editor, out } = load(body);
    const node = el(editor.children[0]);
    expect(node.gitRef).toBe('main');
    expect('ref' in node).toBe(false);
    expect(out()).toBe(body);
  });

  it('reads height={400} as a number and writes it back as an expression', () => {
    const { editor, out } = load('<ModelViewer src="/a.glb" height={400} />\n');
    expect(el(editor.children[0]).height).toBe(400);
    expect(out()).toBe('<ModelViewer src="/a.glb" height={400} />\n');
  });

  it('keeps a non-numeric expression as written', () => {
    const body = '<ModelViewer src="/a.glb" height={size * 2} />\n';
    expect(load(body).out()).toBe(body);
  });

  it('writes a true boolean as a bare attribute and drops false', () => {
    const body = '<Tabs>\n  <TabItem value="a" label="A" default>\n    x\n  </TabItem>\n</Tabs>\n';
    const { editor, out } = load(body);
    expect(el(editor.children[0]!.children[0]).default).toBe(true);
    expect(out()).toBe(body);
    editor.tf.setNodes({ default: false } as Partial<TElement>, { at: [0, 0] });
    expect(out()).toBe('<Tabs>\n  <TabItem value="a" label="A">\n    x\n  </TabItem>\n</Tabs>\n');
  });

  it('turns a generic manifest entry into jsx_void or jsx_container', () => {
    const manifest: ComponentsManifest = {
      components: [
        ...DEFAULT_COMPONENTS.components,
        { name: 'Badge', kind: 'flow', hasChildren: false, preview: 'generic', props: [{ name: 'text', type: 'string' }] },
        { name: 'Details', kind: 'flow', hasChildren: true, preview: 'generic', props: [{ name: 'summary', type: 'string' }] },
      ],
    };
    const m = buildDocsMarkdown(manifest);
    const body = '<Badge text="new" />\n\n<Details summary="More">\n  Hidden **text**.\n</Details>\n';
    const { editor, out } = load(body, m);
    expect(el(editor.children[0])).toMatchObject({ type: DOCS_KEYS.jsxVoid, jsxName: 'Badge', jsxText: 'new' }); // `text` would make Slate see a leaf
    expect(el(editor.children[1])).toMatchObject({ type: DOCS_KEYS.jsxContainer, jsxName: 'Details', summary: 'More' });
    expect(el(editor.children[1]).children[0]).toMatchObject({ type: 'p' });
    expect(out()).toBe(body);
  });

  it('changing a viewer height and alt keeps the other props and their order', () => {
    const input = '<FbxViewer repo="RayanYousef/documentation-system" ref="main" path="examples/unity-project/Assets/Models/Airship.fbx" alt="Airship" height={400} />\n';
    const { editor, out } = load(input);
    editor.tf.setNodes({ height: 500, alt: 'Airship (big)' } as Partial<TElement>, { at: [0] });
    expect(out()).toBe('<FbxViewer repo="RayanYousef/documentation-system" ref="main" path="examples/unity-project/Assets/Models/Airship.fbx" alt="Airship (big)" height={500} />\n');
  });

  it('adds new known props after the ones read from the file, in manifest order', () => {
    const { editor, out } = load('<ModelViewer alt="Cube" src="/c.gltf" />\n');
    editor.tf.setNodes({ height: 240, gitRef: 'main' } as Partial<TElement>, { at: [0] });
    expect(out()).toBe('<ModelViewer alt="Cube" src="/c.gltf" ref="main" height={240} />\n');
  });

  it('slots a prop added in the editor in manifest order between the props read from the file', () => {
    const { editor, out } = load('<FbxViewer src="/models/fbx/p.fbx" alt="P" height={300} />\n');
    editor.tf.unsetNodes('src', { at: [0] });
    editor.tf.setNodes({ path: 'Assets/A.fbx', repo: 'o/r' } as Partial<TElement>, { at: [0] });
    expect(out()).toBe('<FbxViewer repo="o/r" path="Assets/A.fbx" alt="P" height={300} />\n');
  });

  it('writes a node without jsxName under the manifest tag for its type', () => {
    const editor = fresh();
    editor.tf.setValue([{ type: DOCS_KEYS.modelViewer, src: '/models/a.glb', alt: 'a.glb', children: [{ text: '' }] }]);
    expect(exportBody(editor, editor.children, '*', md)).toBe('<ModelViewer src="/models/a.glb" alt="a.glb" />\n');
  });

  describe('a comment or okf block moved into a tab (drag and drop)', () => {
    const TABS = '<Tabs>\n<TabItem value="a">\n\nx\n\n</TabItem>\n</Tabs>\n';
    const mdx = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(remarkMdx);
    const moveIntoTab = (body: string) => {
      const { editor, out } = load(body + '\n' + TABS);
      editor.tf.moveNodes({ at: [0], to: [1, 0, 0] });
      const text = out();
      // Top-level <!-- --> comments are fine (Docusaurus and prepareBody turn them into MDX comments);
      // everything else must parse as MDX.
      expect(() => mdx.parse(prepareBody(text))).not.toThrow();
      expect(importBody(fresh(), `\n${text}`, md).errors).toEqual([]);
      return text;
    };

    it('a block comment is written as an MDX comment inside the tab', () => {
      expect(moveIntoTab('<!-- note to self -->\n')).toBe('<Tabs>\n  <TabItem value="a">\n    {/* note to self */}\n\n    x\n  </TabItem>\n</Tabs>\n');
    });

    it('a paragraph with an inline comment keeps it as an inline MDX comment', () => {
      expect(moveIntoTab('text <!-- c --> more\n')).toBe('<Tabs>\n  <TabItem value="a">\n    text {/* c */} more\n\n    x\n  </TabItem>\n</Tabs>\n');
    });

    it('an okf block is moved back out, after the tabs, and stays an HTML comment pair', () => {
      const okf = '<!-- okf:index -->\n* [a](a.md)\n<!-- /okf:index -->';
      expect(moveIntoTab(`${okf}\n`)).toBe(`<Tabs>\n  <TabItem value="a">\n    x\n  </TabItem>\n</Tabs>\n\n${okf}\n`);
    });

    it('an okf block dragged into a generic container is moved out too', () => {
      const manifest: ComponentsManifest = {
        components: [...DEFAULT_COMPONENTS.components, { name: 'Details', kind: 'flow', hasChildren: true, preview: 'generic', props: [] }],
      };
      const m = buildDocsMarkdown(manifest);
      const okf = '<!-- okf:index -->\n* [a](a.md)\n<!-- /okf:index -->';
      const { editor, out } = load(`${okf}\n\n<Details>\n  x\n</Details>\n`, m);
      editor.tf.moveNodes({ at: [0], to: [1, 0] });
      expect(out()).toBe(`<Details>\n  x\n</Details>\n\n${okf}\n`);
    });

    it('a page with comments inside a tab opens and is written back as valid MDX', () => {
      const { out } = load('<Tabs>\n<TabItem value="a">\n\n<!-- c -->\n\nx <!-- d --> y\n\n</TabItem>\n</Tabs>\n');
      const text = out();
      expect(text).toBe('<Tabs>\n  <TabItem value="a">\n    {/* c */}\n\n    x {/* d */} y\n  </TabItem>\n</Tabs>\n');
      expect(() => mdx.parse(text)).not.toThrow();
      expect(load(text).out()).toBe(text);
    });

    it('comments outside components stay HTML comments', () => {
      const body = '<!-- top -->\n\nText <!-- inline --> here.\n';
      expect(load(body).out()).toBe(body);
    });
  });

  it('has a deserialize rule per tag and a serialize rule per type', () => {
    const rules = componentRules(DEFAULT_COMPONENTS);
    for (const k of ['ModelViewer', 'FbxViewer', 'Tabs', 'TabItem']) expect(rules[k]?.deserialize).toBeTypeOf('function');
    for (const k of [DOCS_KEYS.modelViewer, DOCS_KEYS.fbxViewer, DOCS_KEYS.tabs, DOCS_KEYS.tabItem, DOCS_KEYS.jsxVoid, DOCS_KEYS.jsxContainer]) {
      expect(rules[k]?.serialize).toBeTypeOf('function');
    }
  });
});
