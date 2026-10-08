// Docusaurus plugin for in-place editing. It owns everything the editor needs from the bundler:
// - resolution of the @platform/editor TypeScript sources (`.js` specifiers -> `.ts/.tsx`, `@/` alias)
// - the editor stylesheet: one Tailwind entry (`*.pcss`) compiled to a string inside the lazy editor
//   chunk, never through Docusaurus' CSS pipeline (which merges every CSS import into the global styles.css)
// - the SSR stub for the editor mount module (Plate never enters the server bundle)
// - global data the site's Edit button reads (enabled flag, edit mode)
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import tailwindPostcss from '@tailwindcss/postcss';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

/** Module request of the editor mount (site composition root), swapped for a stub in the server compile. */
export const MOUNT_MODULE = /platform[\\/]inplace[\\/]mountInPlaceEditor/;

/** @param {import('@docusaurus/types').LoadContext} _context @param {{ enabled?: boolean }} options */
export default function platformInplaceEdit(_context, options = {}) {
  const enabled = options.enabled !== false;
  return {
    name: 'platform-inplace-edit',

    configureWebpack(_config, isServer, utils) {
      const webpack = utils.currentBundler.instance;
      return {
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
    },

    async contentLoaded({ actions }) {
      actions.setGlobalData({ enabled, mode: 'github' });
    },
  };
}
