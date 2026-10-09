// Docusaurus plugin for in-place editing. It owns everything the editor needs from the bundler and the
// dev server:
// - resolution of the @platform/editor TypeScript sources (`.js` specifiers -> `.ts/.tsx`, `@/` alias)
// - the editor stylesheet: one Tailwind entry (`*.pcss`) compiled to a string inside the lazy editor
//   chunk, never through Docusaurus' CSS pipeline (which merges every CSS import into the global styles.css)
// - the SSR stub for the editor mount module (Plate never enters the server bundle)
// - on `docusaurus start`: the same-origin, loopback-only, token-guarded disk endpoint (devContentMiddleware)
// - global data the site reads: { enabled, mode, endpoint?, devToken? }
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import tailwindPostcss from '@tailwindcss/postcss';
import { resolveEditMode, devEndpointPath } from './mode.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

/** Module request of the editor mount (site composition root), swapped for a stub in the server compile. */
export const MOUNT_MODULE = /platform[\\/]inplace[\\/]mountInPlaceEditor/;

/**
 * @param {import('@docusaurus/types').LoadContext} context
 * @param {{ enabled?: boolean; codeRepos?: import('@platform/contracts').CodeRepoRef[] }} options
 */
export default function platformInplaceEdit(context, options = {}) {
  const enabled = options.enabled !== false;
  const mode = resolveEditMode({ nodeEnv: process.env.NODE_ENV, forceBackend: process.env.PLATFORM_EDIT_BACKEND });
  const localDisk = enabled && mode === 'local-disk';
  // One secret per dev-server process; only pages served by this process carry it.
  const devToken = localDisk ? randomBytes(32).toString('hex') : null;
  const endpoint = devEndpointPath(context.baseUrl);

  return {
    name: 'platform-inplace-edit',

    configureWebpack(_config, isServer, utils) {
      const webpack = utils.currentBundler.instance;
      /** @type {Record<string, unknown>} */
      const out = {
        resolve: {
          // The editor is TypeScript ESM: its relative imports name the emitted `.js` file.
          extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
          // The vendored shadcn / Plate UI files import `@/richtext/...` (kept in upstream form).
          alias: { '@': path.join(repoRoot, 'services', 'editor', 'src') },
        },
        module: {
          rules: [{
            test: /\.pcss$/i,
            type: 'asset/source',
            use: [{
              loader: require.resolve('postcss-loader'),
              options: { postcssOptions: { config: false, plugins: [tailwindPostcss()] } },
            }],
          }],
        },
        plugins: isServer ? [new webpack.NormalModuleReplacementPlugin(MOUNT_MODULE, path.join(here, 'serverStub.tsx'))] : [],
      };
      if (!isServer && localDisk) {
        out.devServer = {
          // Docusaurus merges this with its own devServer config through webpack-merge, which calls both
          // setupMiddlewares functions with the same array and concatenates their results. Docusaurus'
          // function mutates and returns that array; this one adds the endpoint to the front of the same
          // array and returns [] so nothing is listed twice.
          setupMiddlewares(middlewares) {
            // Imported lazily: only the dev server needs the Node content backend.
            const ready = import('./devContentMiddleware.mjs').then(({ createDevContentMiddleware }) =>
              createDevContentMiddleware({ siteDir: context.siteDir, codeRepos: options.codeRepos ?? [], baseUrl: context.baseUrl, token: devToken }));
            middlewares.unshift({
              name: 'platform-dev-content',
              middleware: (req, res, next) => { ready.then((mw) => mw(req, res, next), next); },
            });
            return [];
          },
        };
      }
      return out;
    },

    async contentLoaded({ actions }) {
      actions.setGlobalData(localDisk ? { enabled, mode, endpoint, devToken } : { enabled, mode: 'github' });
    },
  };
}
