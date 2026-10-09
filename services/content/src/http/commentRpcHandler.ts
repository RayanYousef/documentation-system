import { ContentError, type CommentStore, type CommentWriteOptions } from '@platform/contracts';
import { COMMENT_METHODS, type CommentMethod } from '../comments/HttpCommentStore.js';
import { RpcFailure, readBody, type ContentRpcHandler } from './contentRpcHandler.js';

export interface CommentRpcHandlerOptions {
  /** Request bodies over this many bytes get 413 TOO_LARGE. Default 1 MB (a comments file is small). */
  maxBodyBytes?: number;
}

/**
 * The body of a CommentStore RPC endpoint: `POST {method, args}` -> `{result}` or `{error}`, for HttpCommentStore.
 * Transport only (no CORS, no authentication): the caller routes the request and adds its own guards.
 */
export function createCommentRpcHandler(store: CommentStore, opts: CommentRpcHandlerOptions = {}): ContentRpcHandler {
  const limit = opts.maxBodyBytes ?? 1024 * 1024;
  return async (req, res) => {
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    let method: CommentMethod;
    let args: unknown[];
    try {
      let parsed: unknown;
      const raw = await readBody(req, limit);
      try { parsed = JSON.parse(raw); } catch { throw new RpcFailure(400, 'VALIDATION', 'Request body is not JSON'); }
      const body = parsed as { method?: unknown; args?: unknown };
      if (typeof body?.method !== 'string' || !Array.isArray(body.args)) throw new RpcFailure(400, 'VALIDATION', 'Expected {"method": string, "args": []}');
      if (!COMMENT_METHODS.includes(body.method as CommentMethod)) throw new RpcFailure(403, 'FORBIDDEN', `Method ${body.method} is not available on this endpoint`);
      method = body.method as CommentMethod;
      args = body.args;
    } catch (e) {
      const f = e instanceof RpcFailure ? e : new RpcFailure(400, 'VALIDATION', (e as Error).message);
      send(f.status, { error: { code: f.code, message: f.message } });
      return;
    }
    try {
      const [page, file, writeOpts] = args as [string, never, { message?: unknown; author?: { name?: unknown; email?: unknown }; expectedEtag?: unknown } | undefined];
      if (typeof page !== 'string') throw new ContentError('VALIDATION', 'Expected a page path');
      if (method === 'write' && (typeof writeOpts?.message !== 'string' || typeof writeOpts.author?.name !== 'string' || typeof writeOpts.author.email !== 'string'
        || !(writeOpts.expectedEtag === null || typeof writeOpts.expectedEtag === 'string'))) {
        throw new ContentError('VALIDATION', 'Expected write options {message, author: {name, email}, expectedEtag}');
      }
      const result = method === 'read' ? await store.read(page) : await store.write(page, file, writeOpts as unknown as CommentWriteOptions);
      send(200, { result });
    } catch (e) {
      const err = e instanceof ContentError ? e : new ContentError('NETWORK', (e as Error).message);
      send(200, { error: { code: err.code, message: err.message, details: err.details } });
    }
  };
}
