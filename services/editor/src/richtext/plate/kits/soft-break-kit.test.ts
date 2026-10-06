import { describe, it, expect } from 'vitest';
import type { SlateEditor } from 'platejs';
import { createPlateEditor } from 'platejs/react';
import { DEFAULT_COMPONENTS } from '../../../mdx/componentsManifest.js';
import { buildDocsMarkdown, exportBody, importBody } from '../markdown/docsMarkdown.js';
import { ContentKit } from './content-kit.js';

// Shift+Enter (a soft break) where Markdown cannot hold a line break must do nothing; elsewhere it
// is written as a hard break. Either way the saved page must open again in the visual editor.
const md = buildDocsMarkdown(DEFAULT_COMPONENTS);

/** Load `body`, put the caret at the end of block `at`, run `softBreak`, type "second" and export. */
function softBreakAtEnd(body: string, at: number[], softBreak: (editor: SlateEditor) => void): string {
  const editor = createPlateEditor({ plugins: ContentKit });
  const r = importBody(editor, body, md);
  expect(r.errors).toEqual([]);
  editor.tf.setValue(r.value);
  editor.tf.select(editor.api.end(at));
  softBreak(editor);
  editor.tf.insertText('second');
  const out = exportBody(editor, editor.children, r.bullet, md);
  expect(importBody(createPlateEditor({ plugins: ContentKit }), `\n${out}`, md).errors).toEqual([]);
  return out;
}

// Plate's own transform, and the Slate method that Shift+Enter in the browser calls (slate-react).
const ways: [string, (editor: SlateEditor) => void][] = [
  ['tf.insertSoftBreak', (editor) => editor.tf.insertSoftBreak()],
  // Plate types the legacy Slate methods as unknown; slate-react calls this one on Shift+Enter.
  ['Shift+Enter (editor.insertSoftBreak)', (editor) => (editor as unknown as { insertSoftBreak: () => void }).insertSoftBreak()],
];

describe.each(ways)('soft break via %s', (_label, softBreak) => {
  it('does nothing in a heading', () => {
    expect(softBreakAtEnd('## Title\n\ntext\n', [0], softBreak)).toBe('## Titlesecond\n\ntext\n');
  });

  it('does nothing in a bulleted list item', () => {
    expect(softBreakAtEnd('- item\n- two\n', [0], softBreak)).toBe('- itemsecond\n- two\n');
  });

  it('does nothing in a numbered list item', () => {
    expect(softBreakAtEnd('1. item\n2. two\n', [0], softBreak)).toBe('1. itemsecond\n2. two\n');
  });

  it('is a hard break in a paragraph', () => {
    expect(softBreakAtEnd('para\n', [0], softBreak)).toBe('para\\\nsecond\n');
  });
});
