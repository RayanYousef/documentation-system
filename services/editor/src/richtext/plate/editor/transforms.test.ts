import { describe, it, expect } from 'vitest';
import type { TElement } from 'platejs';
import { createPlateEditor, type PlateEditor } from 'platejs/react';
import type { ComponentsManifest } from '@platform/contracts';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { repoAssetInsert } from '../../assets.js';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody, importBody } from '../markdown/docsMarkdown.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { addTab, insertAsset, insertBasicBlock, insertCallout, insertCodeBlock, insertComponent, insertDivider, insertImage, insertTable, insertTabs, insertViewer } from './transforms.js';

const MANIFEST: ComponentsManifest = {
  components: [
    ...DEFAULT_COMPONENTS.components,
    { name: 'Badge', kind: 'flow', hasChildren: false, preview: 'generic', props: [{ name: 'label', type: 'string' }] },
    { name: 'Panel', kind: 'flow', hasChildren: true, preview: 'generic', props: [] },
  ],
};
const md = buildDocsMarkdown(MANIFEST);

/** An editor holding `body`, with the cursor at the end of the first block. */
function setup(body = 'Intro.\n'): PlateEditor {
  const editor = createPlateEditor({ plugins: ContentKit });
  const r = importBody(editor, body, md);
  expect(r.errors).toEqual([]);
  editor.tf.setValue(r.value.length ? r.value : [{ type: 'p', children: [{ text: '' }] }]);
  editor.tf.select(editor.api.end([0]));
  return editor;
}
const out = (editor: PlateEditor) => exportBody(editor, editor.children, '*', md);
/** Output that imports and exports to itself. */
function stable(text: string): string {
  const again = setup(text);
  expect(out(again)).toBe(text);
  return text;
}
const el = (v: unknown) => v as TElement & Record<string, unknown>;

const TABS = [
  '<Tabs>',
  '  <TabItem value="one" label="One" default>',
  '    First tab',
  '  </TabItem>',
  '',
  '  <TabItem value="two" label="Two">',
  '    Second tab',
  '  </TabItem>',
  '</Tabs>',
].join('\n');

describe('insert transforms', () => {
  it('inserts an uploaded glb as a ModelViewer after the current block', () => {
    const editor = setup();
    insertViewer(editor, MANIFEST, { component: 'ModelViewer', src: '/models/a.glb', alt: 'a.glb' });
    expect(stable(out(editor))).toBe('Intro.\n\n<ModelViewer src="/models/a.glb" alt="a.glb" />\n');
  });

  it('inserts an uploaded fbx as an FbxViewer', () => {
    const editor = setup();
    insertViewer(editor, MANIFEST, { component: 'FbxViewer', src: '/models/fbx/a.fbx', alt: 'a.fbx' });
    expect(stable(out(editor))).toBe('Intro.\n\n<FbxViewer src="/models/fbx/a.fbx" alt="a.fbx" />\n');
  });

  it('inserts an uploaded image as a Markdown image with its alt', () => {
    const editor = setup();
    insertImage(editor, { src: '/CloudDocumentationPersonal/uploads/x.png', alt: 'x.png' });
    expect(stable(out(editor))).toBe('Intro.\n\n![x.png](/CloudDocumentationPersonal/uploads/x.png)\n');
  });

  it('inserts repo assets the old way: models site-relative, images with the base url', () => {
    const editor = setup();
    insertAsset(editor, MANIFEST, repoAssetInsert({ path: 'models/fbx/Air.fbx', url: '/models/fbx/Air.fbx', size: 1, kind: 'model' }, '/Base/'));
    insertAsset(editor, MANIFEST, repoAssetInsert({ path: 'uploads/x.png', url: '/uploads/x.png', size: 1, kind: 'image' }, '/Base/'));
    expect(stable(out(editor))).toBe('Intro.\n\n<FbxViewer src="/models/fbx/Air.fbx" alt="Air.fbx" />\n\n![uploads/x.png](/Base/uploads/x.png)\n');
  });

  it('inserts the same Tabs block as before', () => {
    const editor = setup();
    insertTabs(editor, MANIFEST);
    expect(stable(out(editor))).toBe(`Intro.\n\n${TABS}\n`);
  });

  it('replaces the current block when it is an empty paragraph', () => {
    const editor = setup('');
    insertTabs(editor, MANIFEST);
    expect(out(editor)).toBe(`${TABS}\n`);
  });

  it('inserts a generic component from the manifest', () => {
    const editor = setup();
    insertComponent(editor, MANIFEST, MANIFEST.components.find((c) => c.name === 'Badge')!);
    expect(stable(out(editor))).toBe('Intro.\n\n<Badge />\n');
    const panel = setup();
    insertComponent(panel, MANIFEST, MANIFEST.components.find((c) => c.name === 'Panel')!);
    expect(el(panel.children[1])).toMatchObject({ type: DOCS_KEYS.jsxContainer, jsxName: 'Panel' });
    stable(out(panel));
  });

  it('inserts an empty viewer, or Tabs, from the component menu', () => {
    const editor = setup();
    insertComponent(editor, MANIFEST, MANIFEST.components[0]!);
    insertComponent(editor, MANIFEST, MANIFEST.components[2]!);
    expect(stable(out(editor))).toBe(`Intro.\n\n<ModelViewer />\n\n${TABS}\n`);
  });

  it('adds a TabItem when the menu inserts one inside Tabs, and Tabs elsewhere', () => {
    const editor = setup(`${TABS}\n`);
    editor.tf.select(editor.api.end([0, 0]));
    insertComponent(editor, MANIFEST, MANIFEST.components[3]!);
    expect(editor.children).toHaveLength(1);
    expect(editor.children[0]!.children).toHaveLength(3);
    const outside = setup();
    insertComponent(outside, MANIFEST, MANIFEST.components[3]!);
    expect(stable(out(outside))).toBe(`Intro.\n\n${TABS}\n`);
  });

  it('inserts an admonition, a code block and a divider', () => {
    const editor = setup();
    insertCallout(editor, 'note');
    expect(el(editor.children[1])).toMatchObject({ type: 'callout', variant: 'note' });
    editor.tf.insertText('Mind this.');
    expect(stable(out(editor))).toBe('Intro.\n\n:::note\nMind this.\n:::\n');
    insertDivider(editor); // the cursor is in the admonition, so the divider goes there too
    expect(out(editor)).toBe('Intro.\n\n:::note\nMind this.\n\n---\n:::\n');
    const code = setup();
    insertCodeBlock(code);
    insertDivider(code);
    expect(stable(out(code))).toBe('Intro.\n\n```text\n```\n\n---\n');
  });

  it('inserts inside a TabItem when the cursor is there', () => {
    const editor = setup(`${TABS}\n`);
    editor.tf.select(editor.api.end([0, 1, 0]));
    insertViewer(editor, MANIFEST, { component: 'ModelViewer', src: '/m.glb', alt: 'm' });
    expect(el(el(editor.children[0]!.children[1]).children[1])).toMatchObject({ type: DOCS_KEYS.modelViewer, src: '/m.glb' });
  });

  it('inserts after a code block, not inside it', () => {
    const editor = setup('```text\na\n```\n');
    editor.tf.select(editor.api.end([0]));
    insertImage(editor, { src: '/i.png', alt: 'i' });
    expect(out(editor)).toBe('```text\na\n```\n\n![i](/i.png)\n');
  });

  it('appends at the end when there is no selection', () => {
    const editor = setup();
    editor.tf.deselect();
    insertImage(editor, { src: '/i.png', alt: 'i' });
    expect(out(editor)).toBe('Intro.\n\n![i](/i.png)\n');
  });

  it('adds a tab with a new value', () => {
    const editor = setup(`${TABS}\n`);
    addTab(editor, MANIFEST, [0]);
    const added = el(editor.children[0]!.children[2]);
    expect(added).toMatchObject({ type: DOCS_KEYS.tabItem, jsxName: 'TabItem', value: 'tab3', label: 'Tab 3' });
    expect(stable(out(editor))).toContain('<TabItem value="tab3" label="Tab 3">');
  });
});

describe('slash menu inserts', () => {
  it('inserts a 2 x 2 table with a header row and puts the cursor in it', () => {
    const editor = setup();
    insertTable(editor);
    const table = el(editor.children[1]);
    expect(table.type).toBe('table');
    expect(table.children).toHaveLength(2);
    expect(table.children.map((r) => (r as TElement).children.length)).toEqual([2, 2]);
    expect(editor.selection?.anchor.path.slice(0, 2)).toEqual([1, 0]);
    editor.tf.insertText('H');
    expect(stable(out(editor))).toMatch(/^Intro\.\n\n\| H +\| +\|\n\|---\|---\|\n/);
  });

  it('turns an empty paragraph into a heading, quote or list item', () => {
    const cases: [string, string, string][] = [
      ['h2', 'Title', '## Title'],
      ['blockquote', 'Said', '> Said'],
      ['disc', 'Item', '* Item'],
      ['decimal', 'First', '1. First'],
      ['todo', 'Task', '* [ ] Task'],
      ['p', 'Plain', 'Plain'],
    ];
    for (const [type, text, line] of cases) {
      const editor = setup();
      editor.tf.insertNodes({ type: 'p', children: [{ text: '' }] }, { at: [1], select: true });
      insertBasicBlock(editor, type);
      expect(editor.children, type).toHaveLength(2);
      editor.tf.insertText(text);
      expect(stable(out(editor)), type).toBe(`Intro.\n\n${line}\n`);
    }
  });

  it('inserts code, table and divider through the same entry point', () => {
    const editor = setup();
    insertBasicBlock(editor, 'code_block');
    expect(el(editor.children[1])).toMatchObject({ type: 'code_block', lang: 'text' });
    const rule = setup();
    insertBasicBlock(rule, 'hr');
    expect(out(rule)).toBe('Intro.\n\n---\n');
    const table = setup();
    insertBasicBlock(table, 'table');
    expect(el(table.children[1]).type).toBe('table');
  });
});

describe('Tabs normalizers', () => {
  it('gives an emptied TabItem an empty paragraph', () => {
    const editor = setup(`${TABS}\n`);
    editor.tf.removeNodes({ at: [0, 0, 0] });
    expect(el(editor.children[0]!.children[0])).toMatchObject({ type: DOCS_KEYS.tabItem, children: [{ type: 'p', children: [{ text: '' }] }] });
  });

  it('wraps a non-TabItem child of Tabs in a TabItem', () => {
    const editor = setup(`${TABS}\n`);
    editor.tf.insertNodes({ type: 'p', children: [{ text: 'stray' }] }, { at: [0, 2] });
    const wrapped = el(editor.children[0]!.children[2]);
    expect(wrapped).toMatchObject({ type: DOCS_KEYS.tabItem, children: [{ type: 'p', children: [{ text: 'stray' }] }] });
  });

  it('wraps a TabItem outside Tabs in a Tabs block', () => {
    const editor = setup();
    editor.tf.insertNodes({ type: DOCS_KEYS.tabItem, value: 'x', label: 'X', children: [{ type: 'p', children: [{ text: 'x' }] }] } as TElement, { at: [1] });
    expect(el(editor.children[1])).toMatchObject({ type: DOCS_KEYS.tabs, children: [{ type: DOCS_KEYS.tabItem, value: 'x' }] });
    expect(stable(out(editor))).toBe('Intro.\n\n<Tabs>\n  <TabItem value="x" label="X">\n    x\n  </TabItem>\n</Tabs>\n');
  });

  it('turns a Tabs block with no tabs left into an empty paragraph', () => {
    const editor = setup(`Intro.\n\n${TABS}\n`);
    editor.tf.removeNodes({ at: [1, 1] });
    editor.tf.removeNodes({ at: [1, 0] });
    expect(editor.children.map((n) => n.type)).toEqual(['p', 'p']);
  });

  it('leaves imported pages alone', () => {
    const editor = setup(`Intro.\n\n${TABS}\n`);
    editor.tf.normalize({ force: true });
    expect(out(editor)).toBe(`Intro.\n\n${TABS}\n`);
  });
});
