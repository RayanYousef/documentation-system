import { describe, it, expect } from 'vitest';
import { pageUrl, toEditablePage } from './pagePath';

const doc = (source: string, version = 'current', title = 'T') => toEditablePage({ source, version, title });

describe('toEditablePage', () => {
  it('maps a Latest doc source to its bundle path', () => {
    expect(doc('@site/docs/systems/inventory.md', 'current', 'Inventory')).toEqual({ version: 'current', path: 'systems/inventory.md', title: 'Inventory', isIndex: false });
    expect(doc('@site/docs/getting-started.md')?.path).toBe('getting-started.md');
    expect(doc('@site/docs/guide.mdx')?.path).toBe('guide.mdx');
  });

  it('marks folder intros', () => {
    expect(doc('@site/docs/systems/index.md')).toMatchObject({ path: 'systems/index.md', isIndex: true });
    expect(doc('@site/docs/index.md')).toMatchObject({ path: 'index.md', isIndex: true });
  });

  it('never offers frozen versions', () => {
    expect(doc('@site/versioned_docs/version-1.0.0/systems/inventory.md', '1.0.0')).toBeNull();
    expect(doc('@site/docs/systems/inventory.md', '1.0.0')).toBeNull();
  });

  it('never offers generated files', () => {
    expect(doc('@site/docs/log.md')).toBeNull();
    expect(doc('@site/docs/code-maps/RayanYousef--documentation-system.md')).toBeNull();
  });

  it('refuses anything outside site/docs or not Markdown', () => {
    expect(doc('@site/src/pages/index.md')).toBeNull();
    expect(doc('@site/docs/data.json')).toBeNull();
    expect(doc('@site/docs/../package.md')).toBeNull();
    expect(doc('@site/docs/.hidden/x.md')).toBeNull();
  });
});

describe('pageUrl', () => {
  it('gives the default Docusaurus route of a bundle page under the base url', () => {
    expect(pageUrl('/documentation-system/', 'systems/inventory.md')).toBe('/documentation-system/systems/inventory');
    expect(pageUrl('/documentation-system/', 'systems/index.md')).toBe('/documentation-system/systems/');
    expect(pageUrl('/documentation-system/', 'index.md')).toBe('/documentation-system/');
    expect(pageUrl('/', 'a/b.mdx')).toBe('/a/b');
  });
});
