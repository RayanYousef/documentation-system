// Which backend in-place editing saves through, decided once when the site is built or served.
//   'local-disk': `docusaurus start` (NODE_ENV=development). Saves go to the dev server's same-origin
//                 endpoint and land in the working tree; Docusaurus hot-reloads the page.
//   'github':     every production build (the live site) and the dev server when
//                 PLATFORM_EDIT_BACKEND=github. Saves commit to the deploy branch through the GitHub API.

/** @typedef {'local-disk' | 'github'} EditMode */

/**
 * @param {{ nodeEnv?: string; forceBackend?: string }} env
 * @returns {EditMode}
 */
export function resolveEditMode({ nodeEnv, forceBackend }) {
  if (forceBackend === 'github') return 'github';
  if (forceBackend === 'local-disk') return nodeEnv === 'development' ? 'local-disk' : 'github';
  return nodeEnv === 'development' ? 'local-disk' : 'github';
}

/** Path (under baseUrl) of the dev server's content endpoint: `<baseUrl>__platform/content`. */
export const devEndpointPath = (baseUrl) => `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}__platform/content`;
