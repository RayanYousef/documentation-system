import { createServer } from 'node:http';
import type { ContentBackend } from '@platform/contracts';
import { createContentRpcHandler, type ContentRpcHandlerOptions } from './contentRpcHandler.js';

/**
 * Exposes any ContentBackend over POST /rpc {method, args} on its own port, with open CORS.
 * A dev/e2e tool only (no auth); the dev server's same-origin endpoint uses createContentRpcHandler directly.
 */
export async function serveContentBackend(backend: ContentBackend, opts: { port?: number; host?: string } & ContentRpcHandlerOptions = {}): Promise<{ url: string; close(): Promise<void> }> {
  const handle = createContentRpcHandler(backend, opts);
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST' || req.url !== '/rpc') { res.writeHead(404); res.end(); return; }
    await handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : opts.port;
  return { url: `http://${opts.host ?? '127.0.0.1'}:${port}`, close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))) };
}
