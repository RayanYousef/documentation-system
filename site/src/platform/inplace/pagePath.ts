// Which docs pages can be edited in place, and where a bundle page lives on the site. Pure (no
// Docusaurus imports), so it is unit-tested in Node and safe to use from reader code.
import type { EditablePage } from '@platform/editor/inplace';

export type { EditablePage };

export interface DocInfo {
  /** useDoc().metadata.source, for example "@site/docs/systems/inventory.md". */
  source: string;
  /** useDoc().metadata.version: "current" for the Latest docs, else the frozen version label. */
  version: string;
  title: string;
}

const LATEST_PREFIX = '@site/docs/';
/** Generated files: written by okf:generate / every save, never by hand. */
const GENERATED = [/^log\.md$/, /^code-maps\//];

/** The editable page for a doc, or null (frozen versions, generated files, anything outside site/docs). */
export function toEditablePage({ source, version, title }: DocInfo): EditablePage | null {
  if (version !== 'current' || !source.startsWith(LATEST_PREFIX)) return null;
  const path = source.slice(LATEST_PREFIX.length);
  if (!/\.mdx?$/.test(path) || path.split('/').some((s) => s === '..' || s.startsWith('.'))) return null;
  if (GENERATED.some((r) => r.test(path))) return null;
  const file = path.split('/').at(-1)!;
  return { version: 'current', path, title, isIndex: /^index\.mdx?$/.test(file) };
}

/**
 * Site URL of a Latest bundle page (docs are served at the site root):
 * "systems/inventory.md" -> "<base>systems/inventory", "systems/index.md" -> "<base>systems/", "index.md" -> "<base>".
 * Pages with a custom `slug` live elsewhere; this is the default route Docusaurus gives the file.
 */
export function pageUrl(baseUrl: string, pagePath: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const route = pagePath.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '$1');
  return `${base}${route}`;
}
