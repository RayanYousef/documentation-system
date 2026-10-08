import { describe, it, expect } from 'vitest';
import { readFields, splitDocument } from '../frontmatter/yamlDoc.js';
import { composeDocument } from './composeDocument.js';

const page = '---\ntitle: Inventory\ndescription: Explains how items are stored.\ntype: system\ntags: [inventory, items]\nsidebar_position: 2\n---\n\n# Body\n\nText.\n';
const fields = readFields(splitDocument(page).head);

describe('composeDocument', () => {
  it('returns the loaded file byte for byte when nothing changed', () => {
    expect(composeDocument({ base: page, fields, body: splitDocument(page).body, mode: 'visual', raw: '' })).toBe(page);
    expect(composeDocument({ base: page, fields: null, body: null, mode: 'visual', raw: '' })).toBe(page);
  });

  it('keeps an odd fence layout byte for byte when unchanged', () => {
    const odd = '---\r\ntitle: A\r\n---\r\nBody without a blank line.\r\n';
    expect(composeDocument({ base: odd, fields: readFields(splitDocument(odd).head), body: splitDocument(odd).body, mode: 'visual', raw: '' })).toBe(odd);
  });

  it('applies a changed field and keeps the other keys and the body', () => {
    const out = composeDocument({ base: page, fields: { ...fields, title: 'Inventory v2' }, body: null, mode: 'visual', raw: '' });
    expect(out).toBe(page.replace('title: Inventory\n', 'title: Inventory v2\n'));
  });

  it('puts a new body under the frontmatter with one blank line', () => {
    const out = composeDocument({ base: page, fields, body: 'New body.\n', mode: 'visual', raw: '' });
    expect(out).toBe(`${page.slice(0, page.indexOf('---\n\n') + 4)}\nNew body.\n`);
  });

  it('a page without frontmatter is just its body', () => {
    expect(composeDocument({ base: 'Plain.\n', fields: null, body: 'Plain, edited.\n', mode: 'visual', raw: '' })).toBe('Plain, edited.\n');
  });

  it('Raw mode saves the raw text as typed', () => {
    expect(composeDocument({ base: page, fields, body: 'ignored', mode: 'raw', raw: 'raw text' })).toBe('raw text');
  });
});
