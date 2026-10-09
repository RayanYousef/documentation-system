// Which comment files the site serves: one per Latest doc page, `platform/comments/<page>.json` (the page's
// `<siteDir>/comments/<page>.json`, or an empty file when it has none, so a reader's request never 404s).
import { readdir, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { commentsFileName, emptyCommentsFile } from '@platform/contracts';
import { parseCommentsFile } from '@platform/content/comments';

const exists = (p) => access(p).then(() => true, () => false);
/** Files Docusaurus does not render (docusaurus.config.js `exclude`), plus hidden ones. */
const NOT_A_PAGE = (name) => name.startsWith('_') || name.startsWith('.') || name === 'AGENTS.md' || name === 'README.md';

/** Bundle-relative paths of the Latest doc pages (`*.md`, `*.mdx`) under `docsDir`. */
export async function listDocPages(docsDir, rel = '') {
  const out = [];
  for (const entry of await readdir(path.join(docsDir, rel), { withFileTypes: true })) {
    if (NOT_A_PAGE(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await listDocPages(docsDir, child));
    else if (/\.mdx?$/.test(entry.name)) out.push(child);
  }
  return out.sort();
}

/**
 * The published text of a page's comments. A stored file that does not pass the comments file check is
 * reported through `warn` and published empty, so one bad hand edit cannot break the deploy (it stays in Git).
 */
export async function publishedComments(commentsDir, page, warn = (m) => console.warn(m)) {
  const src = path.join(commentsDir, ...commentsFileName(page).split('/'));
  if (!(await exists(src))) return JSON.stringify(emptyCommentsFile(page));
  try {
    return JSON.stringify(parseCommentsFile(await readFile(src, 'utf8'), page));
  } catch (e) {
    warn(`[platform-comments] ${path.relative(process.cwd(), src)} was not published: ${e.message}`);
    return JSON.stringify(emptyCommentsFile(page));
  }
}

/** Writes `<outDir>/<page>.json` for every Latest doc page; returns the page paths. */
export async function publishComments({ docsDir, commentsDir, outDir, warn }) {
  const pages = await listDocPages(docsDir);
  for (const page of pages) {
    const dest = path.join(outDir, ...commentsFileName(page).split('/'));
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, await publishedComments(commentsDir, page, warn));
  }
  return pages;
}
