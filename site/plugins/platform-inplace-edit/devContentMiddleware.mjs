// Dev-server-only content endpoint: lets in-place editing on `npm start` write straight to site/docs
// (no git commit; the developer commits with their own git flow). Mounted by the plugin through
// devServer.setupMiddlewares, so it exists only under `docusaurus start`, on the site's own origin.
//
// Guards, in order (every refusal is a 403 JSON response):
//   1. the TCP peer is loopback (even when the dev server listens on 0.0.0.0)
//   2. the Host header names a loopback host (DNS rebinding)
//   3. an Origin header, when present, is this same origin (cross-site requests)
//   4. POST bodies are application/json (no CORS-simple form posts)
//   5. X-Platform-Dev-Token equals the per-process token the plugin put in the page's global data
// Then the RPC handler applies a method allow-list (no publishVersion) and a 25 MB body limit, and the
// backend confines every page path to the bundle (assertPagePath) and asset path to static/.
import { timingSafeEqual } from 'node:crypto';
import { LocalFolderBackend, WorkingTreeCommitter, createContentRpcHandler } from '@platform/content/node';
import { devEndpointPath } from './mode.mjs';

/** Methods the dev endpoint serves. publishVersion is left out: it would write versioned_docs and tag on a dev machine. */
export const DEV_ALLOWED_METHODS = ['listVersions', 'listPages', 'readPage', 'writePage', 'createPage', 'deletePage', 'renamePage', 'uploadAsset', 'listAssets', 'getAsset'];
export const DEV_MAX_BODY_BYTES = 25 * 1024 * 1024;
export const DEV_TOKEN_HEADER = 'x-platform-dev-token';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Hostname of a Host header value ("localhost:3000" -> "localhost", "[::1]:3000" -> "[::1]"). */
function hostName(host) {
  if (!host) return '';
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1).toLowerCase();
  return host.split(':')[0].toLowerCase();
}

function sameToken(given, expected) {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Why a request is refused, or null when it passes the guards. */
export function refusalReason(req, token, { needsJson }) {
  if (!LOOPBACK_ADDRESSES.has(req.socket?.remoteAddress ?? '')) return 'request does not come from this machine';
  const host = req.headers.host ?? '';
  if (!LOOPBACK_HOSTS.has(hostName(host))) return `Host "${host}" is not a loopback host`;
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}` && origin !== `https://${host}`) return `cross-origin request from ${origin}`;
  if (needsJson && !String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return 'body is not application/json';
  if (!sameToken(req.headers[DEV_TOKEN_HEADER], token)) return 'missing or wrong dev token';
  return null;
}

/**
 * @param {{ siteDir: string; codeRepos: import('@platform/contracts').CodeRepoRef[]; baseUrl: string; token: string;
 *   backend?: import('@platform/contracts').ContentBackend; log?: (msg: string) => void }} opts
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void}
 */
export function createDevContentMiddleware({ siteDir, codeRepos, baseUrl, token, backend, log = (m) => console.warn(m) }) {
  if (!token) throw new Error('createDevContentMiddleware needs a token');
  const base = devEndpointPath(baseUrl);
  const handle = createContentRpcHandler(backend ?? new LocalFolderBackend({ siteDir, codeRepos, committer: new WorkingTreeCommitter() }), {
    allow: DEV_ALLOWED_METHODS,
    maxBodyBytes: DEV_MAX_BODY_BYTES,
  });
  const logged = new Set();
  const refuse = (res, reason) => {
    if (!logged.has(reason)) { logged.add(reason); log(`[platform-inplace-edit] refused a content request: ${reason}`); }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'FORBIDDEN', message: `Dev content endpoint: ${reason}` } }));
  };

  return function devContentMiddleware(req, res, next) {
    const pathname = new URL(req.url ?? '/', 'http://local').pathname;
    const route = pathname === `${base}/ping` ? 'ping' : pathname === `${base}/rpc` ? 'rpc' : null;
    if (!route) { next(); return; }
    const method = route === 'ping' ? 'GET' : 'POST';
    if (req.method !== method) { res.writeHead(405, { Allow: method }); res.end(); return; }
    const reason = refusalReason(req, token, { needsJson: route === 'rpc' });
    if (reason) { refuse(res, reason); return; }
    if (route === 'ping') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, backend: 'local-disk' }));
      return;
    }
    handle(req, res).catch((e) => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'NETWORK', message: String(e?.message ?? e) } }));
    });
  };
}
