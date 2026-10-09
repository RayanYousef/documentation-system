import { describe, it, expect } from 'vitest';
import type { TElement } from 'platejs';
import { createPlateEditor, type PlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { ContentKit } from '../kits/content-kit.js';
import { buildDocsMarkdown, exportBody, importBody } from '../markdown/docsMarkdown.js';

const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const TABS = [
  '<Tabs>',
  '  <TabItem value="one" label="One" default>',
  '    First tab',
  '  </TabItem>',
  '',
  '  <TabItem value="two" label="Two">',
  '    Second tab',
  '  </TabItem>',
  '',
  '  <TabItem value="three" label="Three">',
  '    Third tab',
  '  </TabItem>',
  '</Tabs>',
].join('\n');

function setup(body: string): PlateEditor {
  const editor = createPlateEditor({ plugins: ContentKit });
  const r = importBody(editor, body, md);
  expect(r.errors).toEqual([]);
  editor.tf.setValue(r.value);
  return editor;
}
const defaults = (editor: PlateEditor) => ((editor.children[0] as TElement).children as TElement[]).map((c) => c['default'] === true);

describe('the default tab of a Tabs block', () => {
  it('making another tab the default clears the default of the first one (the site honours only the first default)', () => {
    const editor = setup(TABS);
    expect(defaults(editor)).toEqual([true, false, false]);
    editor.tf.setNodes({ default: true }, { at: [0, 2] });
    expect(defaults(editor)).toEqual([false, false, true]);
    expect(exportBody(editor, editor.children, '*', md)).toMatch(/<TabItem value="three" label="Three" default>/);
    expect(exportBody(editor, editor.children, '*', md)).not.toMatch(/value="one" label="One" default/);
  });

  it('clearing the default leaves no default; other edits of a tab do not touch the others', () => {
    const editor = setup(TABS);
    editor.tf.unsetNodes('default', { at: [0, 0] });
    expect(defaults(editor)).toEqual([false, false, false]);
    editor.tf.setNodes({ label: 'Renamed' }, { at: [0, 1] });
    expect(defaults(editor)).toEqual([false, false, false]);
  });

  it('a page that already has two defaults is not changed just by opening it', () => {
    const editor = setup(TABS.replace('label="Two"', 'label="Two" default'));
    expect(defaults(editor)).toEqual([true, true, false]);
  });
});
