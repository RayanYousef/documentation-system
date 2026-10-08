import type { IncomingMessage, ServerResponse } from 'node:http';
import { ContentError, type ContentBackend, type ContentErrorCode } from '@platform/contracts';

/** Every ContentBackend method name (the RPC surface). */
export type ContentMethod = Exclude<keyof ContentBackend, 'id'>;

export const CONTENT_METHODS: readonly ContentMethod[] = [
  'listVersions', 'listPages', 'readPage', 'writePage', 'createPage', 'deletePage', 'renamePage',
  'uploadAsset', 'listAssets', 'search', 'publishVersion', 'getAsset',
];

export interface ContentRpcHandlerOptions {
  /** Methods callers may invoke. Default: every ContentBackend method. */
  allow?: readonly ContentMethod[];
  /** Request bodies over this many bytes get 413 TOO_LARGE. Default 25 MB. */
  maxBodyBytes?: number;
}

export type ContentRpcHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const DEFAULT_MAX_BODY = 25 * 1024 * 1024;

class RpcFailure extends Error {
  constructor(public readonly status: number, public readonly code: ContentErrorCode, message: string) { super(message); }
}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > limit) throw new RpcFailure(413, 'TOO_LARGE', `Request body over ${limit} bytes`);
  const chunks: Buffer[] = [];
  let size = 0;
  // Over the limit: keep draining (so the client sees the 413 instead of a reset) but stop buffering.
  for await (const c of req) {
    size += (c as Buffer).byteLength;
    if (size <= limit) chunks.push(c as Buffer);
  }
  if (size > limit) throw new RpcFailure(413, 'TOO_LARGE', `Request body over ${limit} bytes`);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * The body of a ContentBackend RPC endpoint: `POST {method, args}` -> `{result}` or `{error}`.
 * Transport only: no CORS headers, no authentication. Callers route the request and add their own
 * guards (serveContentBackend adds CORS for the dev/e2e tool; the dev server adds loopback + token checks).
 */
export function createContentRpcHandler(backend: ContentBackend, opts: ContentRpcHandlerOptions = {}): ContentRpcHandler {
  const allow = new Set<string>(opts.allow ?? CONTENT_METHODS);
  const limit = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  return async (req, res) => {
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    let method: string;
    let args: unknown[];
    try {
      const raw = await readBody(req, limit);
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { throw new RpcFailure(400, 'VALIDATION', 'Request body is not JSON'); }
      const body = parsed as { method?: unknown; args?: unknown };
      if (typeof body?.method !== 'string' || !Array.isArray(body.args)) throw new RpcFailure(400, 'VALIDATION', 'Expected {"method": string, "args": []}');
      method = body.method;
      args = body.args;
      if (!CONTENT_METHODS.includes(method as ContentMethod) || !allow.has(method) || typeof (backend as unknown as Record<string, unknown>)[method] !== 'function') {
        throw new RpcFailure(403, 'FORBIDDEN', `Method ${method} is not available on this endpoint`);
      }
    } catch (e) {
      const f = e instanceof RpcFailure ? e : new RpcFailure(400, 'VALIDATION', (e as Error).message);
      send(f.status, { error: { code: f.code, message: f.message } });
      return;
    }
    try {
      if (method === 'uploadAsset') args[1] = new Uint8Array(Buffer.from(String((args[1] as { base64?: unknown })?.base64 ?? ''), 'base64'));
      let result: unknown = await (backend[method as ContentMethod] as (...a: unknown[]) => Promise<unknown>).apply(backend, args);
      if (method === 'getAsset') { const blob = result as Blob; result = { base64: Buffer.from(await blob.arrayBuffer()).toString('base64'), type: blob.type }; }
      send(200, { result });
    } catch (e) {
      const err = e instanceof ContentError ? e : new ContentError('NETWORK', (e as Error).message);
      send(200, { error: { code: err.code, message: err.message, details: err.details } });
    }
  };
}
