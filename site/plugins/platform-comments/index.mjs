// Docusaurus plugin for comments on doc pages (site/docs/platform/comments.md). Readers fetch a page's comments
// as a static file, never through the GitHub API:
// - `docusaurus build`: postBuild writes `platform/comments/<page>.json` for every Latest doc page from
//   `<siteDir>/comments/<page>.json` (or an empty file), so every reader request finds a file
// - `docusaurus start`: the dev server answers the same URLs from the disk, fresh on every request
// - global data the site reads: { enabled }
// Writing comments is not here: the live site commits through GitHub, the dev server writes through the
// in-place editing plugin's guarded disk endpoint.
import path from 'node:path';
import { access } from 'node:fs/promises';
import { publishComments, publishedComments } from './publish.mjs';

/** URL path (under baseUrl) of the published comment files. */
export const commentsPath = (baseUrl) => `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}platform/comments/`;
const FILE = /^(?:[\w.-]+\/)*[\w.-]+\.json$/;

/**
 * @param {import('@docusaurus/types').LoadContext} context
 * @param {{ enabled?: boolean }} options
 */
export default function platformComments(context, options = {}) {
  const enabled = options.enabled !== false;
  const docsDir = path.join(context.siteDir, 'docs');
  const commentsDir = path.join(context.siteDir, 'comments');
  const base = commentsPath(context.baseUrl);

  return {
    name: 'platform-comments',

    configureWebpack(_config, isServer) {
      if (isServer || !enabled) return {};
      return {
        devServer: {
          // Merged with Docusaurus' own setupMiddlewares like the in-place editing plugin's (see its comment).
          setupMiddlewares(middlewares) {
            middlewares.unshift({
              name: 'platform-comments',
              middleware: (req, res, next) => {
                let pathname;
                try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname); } catch { next(); return; } // malformed %-escape
                if (req.method !== 'GET' || !pathname.startsWith(base)) { next(); return; }
                const name = pathname.slice(base.length);
                if (!FILE.test(name) || name.split('/').some((s) => s === '..' || s.startsWith('.'))) { next(); return; }
                const stem = name.replace(/\.json$/, '');
                access(path.join(docsDir, ...`${stem}.mdx`.split('/'))).then(() => `${stem}.mdx`, () => `${stem}.md`)
                  .then((page) => publishedComments(commentsDir, page)).then((text) => {
                  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                  res.end(text);
                }, next);
              },
            });
            return [];
          },
        },
      };
    },

    async contentLoaded({ actions }) {
      actions.setGlobalData({ enabled });
    },

    async postBuild({ outDir }) {
      if (!enabled) return;
      const pages = await publishComments({ docsDir, commentsDir, outDir: path.join(outDir, 'platform', 'comments') });
      console.log(`[platform-comments] published comments for ${pages.length} pages`);
    },
  };
}
