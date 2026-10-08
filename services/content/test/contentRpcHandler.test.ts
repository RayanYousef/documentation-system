import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ContentError, type ContentBackend } from '@platform/contracts';
import { createContentRpcHandler, type ContentRpcHandlerOptions } from '../src/node.js';

let server: Server | null = null;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

async function serve(backend: Partial<ContentBackend>, opts?: ContentRpcHandlerOptions): Promise<string> {
  const handler = createContentRpcHandler(backend as ContentBackend, opts);
  server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const post = (url: string, body: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
const call = (url: string, method: string, args: unknown[] = []) => post(url, JSON.stringify({ method, args }));

describe('createContentRpcHandler', () => {
  it('dispatches an allowed method and returns its result', async () => {
    const listVersions = vi.fn(async () => [{ id: 'current', label: 'Latest', frozen: false }]);
    const url = await serve({ listVersions }, { allow: ['listVersions'] });
    const res = await call(url, 'listVersions');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: [{ id: 'current', label: 'Latest', frozen: false }] });
    expect(listVersions).toHaveBeenCalledOnce();
  });

  it('refuses a method outside the allow-list without calling it', async () => {
    const publishVersion = vi.fn();
    const url = await serve({ publishVersion, readPage: vi.fn() }, { allow: ['readPage'] });
    const res = await call(url, 'publishVersion', ['1.0.0', {}]);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatchObject({ code: 'FORBIDDEN' });
    expect(publishVersion).not.toHaveBeenCalled();
  });

  it('refuses names that are not backend methods (constructor, id, prototype keys)', async () => {
    const url = await serve({ id: 'x' } as Partial<ContentBackend>);
    for (const method of ['constructor', 'id', '__proto__', 'toString']) {
      const res = await call(url, method);
      expect(res.status, method).toBe(403);
      expect((await res.json()).error, method).toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('answers 413 TOO_LARGE when the body is over the limit', async () => {
    const listVersions = vi.fn();
    const url = await serve({ listVersions }, { maxBodyBytes: 64 });
    const res = await call(url, 'listVersions', ['x'.repeat(200)]);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatchObject({ code: 'TOO_LARGE' });
    expect(listVersions).not.toHaveBeenCalled();
  });

  it('answers 400 on a malformed body', async () => {
    const url = await serve({ listVersions: vi.fn() });
    const res = await post(url, '{nope');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: 'VALIDATION' });
    const res2 = await post(url, JSON.stringify({ method: 'listVersions', args: 'nope' }));
    expect(res2.status).toBe(400);
  });

  it('maps ContentError to its code and details, other errors to NETWORK', async () => {
    const url = await serve({
      readPage: vi.fn(async () => { throw new ContentError('CONFLICT', 'moved', { reason: 'x' }); }),
      listPages: vi.fn(async () => { throw new Error('boom'); }),
    });
    expect((await (await call(url, 'readPage', ['current', 'a.md'])).json()).error).toEqual({ code: 'CONFLICT', message: 'moved', details: { reason: 'x' } });
    expect((await (await call(url, 'listPages', ['current'])).json()).error).toMatchObject({ code: 'NETWORK', message: 'boom' });
  });

  it('decodes uploadAsset bytes and encodes getAsset blobs', async () => {
    const uploadAsset = vi.fn(async (_p: string, bytes: Uint8Array) => ({ size: bytes.byteLength, first: bytes[0] }));
    const getAsset = vi.fn(async () => new Blob(['hi'], { type: 'text/plain' }));
    const url = await serve({ uploadAsset, getAsset } as unknown as Partial<ContentBackend>);
    const up = await (await call(url, 'uploadAsset', ['models/a.glb', { base64: Buffer.from('abc').toString('base64') }, {}])).json();
    expect(up.result).toEqual({ size: 3, first: 97 });
    const got = await (await call(url, 'getAsset', [{ repo: 'o/r', ref: 'main', path: 'a' }])).json();
    expect(got.result).toEqual({ base64: Buffer.from('hi').toString('base64'), type: 'text/plain' });
  });

  it('sends no CORS headers', async () => {
    const url = await serve({ listVersions: vi.fn(async () => []) });
    const res = await call(url, 'listVersions');
    expect([...res.headers.keys()].filter((k) => k.startsWith('access-control-'))).toEqual([]);
  });
});
