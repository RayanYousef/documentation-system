import { describe, it, expect } from 'vitest';
import { ElementApi, KEYS, type Path, type TElement } from 'platejs';
import { createPlateEditor, type PlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { ContentKit } from '../kits/content-kit.js';
import { EditorKit } from '../kits/editor-kit.js';
import { buildDocsMarkdown, exportBody, importBody } from '../markdown/docsMarkdown.js';
import { columnAlign, insertColumn, removeColumn, setColumnAlign } from './table.js';

const md = buildDocsMarkdown(DEFAULT_COMPONENTS);
const TABLE = '| Left | Mid | Right |\n|:---|---|---:|\n| a | b | 1 |\n';

/** An editor holding `body`, with the cursor in the body cell of column `col` (or in the first block when col < 0). */
function setup(col: number, body = TABLE): PlateEditor {
  const editor = createPlateEditor({ plugins: ContentKit });
  const r = importBody(editor, body, md);
  expect(r.errors).toEqual([]);
  editor.tf.setValue(r.value);
  editor.tf.select(editor.api.end(col < 0 ? [0] : [0, 1, col]));
  return editor;
}
const out = (editor: PlateEditor) => exportBody(editor, editor.children, '*', md);

describe('table column tools', () => {
  it('reads the alignment of the column at the cursor', () => {
    expect(columnAlign(setup(0))).toBe('left');
    expect(columnAlign(setup(1))).toBeNull();
    expect(columnAlign(setup(2))).toBe('right');
  });

  it('sets the alignment of the column at the cursor', () => {
    const editor = setup(1);
    setColumnAlign(editor, 'center');
    expect(out(editor)).toBe('| Left | Mid | Right |\n|:---|:---:|---:|\n| a | b | 1 |\n');
    setColumnAlign(editor, null);
    expect(out(editor)).toBe(TABLE);
  });

  it('aligns a column of a table that had no alignment', () => {
    const editor = setup(1, '| A | B |\n|---|---|\n| 1 | 2 |\n');
    setColumnAlign(editor, 'right');
    expect(out(editor)).toBe('| A | B |\n|---|---:|\n| 1 | 2 |\n');
  });

  it('keeps each column alignment when a column is inserted or removed', () => {
    const editor = setup(1);
    insertColumn(editor, { before: true });
    expect(out(editor).split('\n')[1]).toBe('|:---|---|---|---:|');
    editor.tf.select(editor.api.end([0, 1, 0]));
    removeColumn(editor);
    expect(out(editor).split('\n')[1]).toBe('|---|---|---:|');
    editor.tf.select(editor.api.end([0, 1, 2]));
    insertColumn(editor);
    expect(out(editor).split('\n')[1]).toBe('|---|---|---:|---|');
  });

  it('does nothing outside a table', () => {
    const editor = setup(0, 'Text.\n');
    expect(columnAlign(editor)).toBeNull();
    setColumnAlign(editor, 'center');
    expect(out(editor)).toBe('Text.\n');
  });
});

describe('table cells hold one line of text', () => {
  const CELLS = '| h1 | h2 |\n|---|---|\n| a | b |\n\n## Next section\n\nMore text.\n';
  /** The real editor (with the input rules), cursor at the end of body cell `a`. */
  function typing(): PlateEditor {
    const editor = createPlateEditor({ plugins: EditorKit });
    const r = importBody(editor, CELLS, md);
    expect(r.errors).toEqual([]);
    editor.tf.setValue(r.value);
    editor.tf.select(editor.api.end([0, 1, 0]));
    return editor;
  }
  const type = (editor: PlateEditor, text: string) => { for (const c of text) editor.tf.insertText(c); };
  /** The export must reopen in the rich editor and keep the rest of the page. */
  const reopens = (editor: PlateEditor) => {
    const saved = out(editor);
    const again = importBody(createPlateEditor({ plugins: ContentKit }), saved, md);
    expect(again.errors).toEqual([]);
    expect(saved).toContain('\n## Next section\n\nMore text.\n');
    return saved;
  };

  it('writes Enter in a cell as <br/>, and the page reopens', () => {
    const editor = typing();
    editor.tf.insertBreak();
    type(editor, 'second');
    expect(reopens(editor)).toBe('| h1 | h2 |\n|---|---|\n| a<br/>second | b |\n\n## Next section\n\nMore text.\n');
  });

  it('keeps ``` typed in a cell as text: no code block swallows the rest of the page', () => {
    const editor = typing();
    editor.tf.insertBreak();
    type(editor, '```');
    editor.tf.insertText('x');
    expect(editor.api.some({ match: { type: KEYS.codeBlock } })).toBe(false);
    reopens(editor);
  });

  it.each([['- '], ['1. '], ['# '], ['> '], ['[] ']])('keeps "%s" typed at the start of a cell as text', (marker) => {
    const editor = typing();
    editor.tf.select(editor.api.start([0, 1, 0]));
    type(editor, marker);
    const saved = reopens(editor);
    expect(saved).not.toMatch(/<ul>|<ol>|<li>|<h1>|<blockquote>/);
    expect(editor.api.some({ at: [0], match: (n) => ElementApi.isElement(n) && n.type !== KEYS.p && !['table', 'tr', 'td', 'th'].includes(n.type) })).toBe(false);
  });

  it('turns any block put into a cell into a paragraph', () => {
    const editor = typing();
    const cell: Path = [0, 1, 0];
    editor.tf.insertNodes([
      { type: KEYS.codeBlock, children: [{ type: KEYS.codeLine, children: [{ text: 'npm' }] }, { type: KEYS.codeLine, children: [{ text: 'ci' }] }] },
      { type: 'h2', children: [{ text: 'Head' }] },
      { type: KEYS.blockquote, children: [{ type: KEYS.p, children: [{ text: 'Quoted' }] }] },
      { type: KEYS.p, listStyleType: 'disc', indent: 1, children: [{ text: 'Item' }] },
      { type: KEYS.hr, children: [{ text: '' }] },
    ], { at: [...cell, 1] });
    const types = (editor.api.node<TElement>(cell)![0].children as TElement[]).map((c) => c.type);
    expect(types.every((t) => t === KEYS.p)).toBe(true);
    expect(reopens(editor)).toContain('| a<br/>npm ci<br/>Head<br/>Quoted<br/>Item');
  });
});
