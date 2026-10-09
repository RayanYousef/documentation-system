// Integration test of the dev-server disk endpoint: a real HTTP server, the real middleware, the real
// LocalFolderBackend over a temp git repository holding a copy of site/docs.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, request, type IncomingMessage, type Server } from 'node:http';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpContentBackend } from '@platform/content';
import { HttpCommentStore } from '@platform/content/comments';
import { git } from '@platform/content/node';
import platform from '../../../platform.config.js';
import { createDevContentMiddleware, DEV_TOKEN_HEADER } from './devContentMiddleware.mjs';

const siteSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = '/documentation-system/';
const TOKEN = 'a'.repeat(64);
const author = { name: 'Dev', email: 'dev@example.com' };

let repo = '';
let siteDir = '';
let server: Server;
let origin = '';
const logs: string[] = [];

beforeAll(async () => {
  repo = await mkdtemp(path.join(tmpdir(), 'dev-endpoint-'));
  siteDir = path.join(repo, 'site');
  await cp(path.join(siteSrc, 'docs'), path.join(siteDir, 'docs'), { recursive: true });
  await cp(path.join(siteSrc, 'versions.json'), path.join(siteDir, 'versions.json'));
  await mkdir(path.join(siteDir, 'static', 'uploads'), { recursive: true });
  await writeFile(path.join(repo, 'package.json'), '{"name":"outside"}\n');
  await git(repo, 'init', '-q', '-b', 'main');
  await git(repo, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'add', '-A');
  await git(repo, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'commit', '-q', '-m', 'seed');
  const mw = createDevContentMiddleware({ siteDir, codeRepos: platform.codeRepos, baseUrl: BASE, token: TOKEN, log: (m) => logs.push(m) });
  server = createServer((req: IncomingMessage, res) => {
    // Test hook: pretend the request came from another machine (a view of req with another peer address;
    // the socket itself is kept-alive and shared with later requests, so it is not modified).
    const fake = req.headers['x-test-remote'];
    const view = typeof fake === 'string' ? Object.assign(Object.create(req) as IncomingMessage, { socket: { remoteAddress: fake } }) : req;
    mw(view, res, () => { res.writeHead(404); res.end('next'); });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(repo, { recursive: true, force: true });
});

const endpoint = () => `${origin}${BASE}__platform/content`;
const withToken = (token: string | null): typeof fetch => (input, init) => {
  const headers = new Headers(init?.headers);
  if (token !== null) headers.set(DEV_TOKEN_HEADER, token);
  return fetch(input, { ...init, headers });
};
const backend = (token: string | null = TOKEN) => new HttpContentBackend(endpoint(), withToken(token));
/** POST through node:http (fetch does not let a caller set Host). Resolves the status code. */
const rpc = (headers: Record<string, string>, body: unknown = { method: 'listVersions', args: [] }, route = 'rpc') => new Promise<{ status: number }>((resolve, reject) => {
  const url = new URL(`${endpoint()}/${route}`);
  const req = request({ host: url.hostname, port: url.port, path: url.pathname, method: 'POST', agent: false, headers: { 'Content-Type': 'application/json', [DEV_TOKEN_HEADER]: TOKEN, ...headers } }, (res) => {
    res.resume();
    res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
  });
  req.on('error', reject);
  req.end(JSON.stringify(body));
});
const commitCount = async () => Number(await git(repo, 'rev-list', '--count', 'HEAD'));

describe('dev content endpoint', () => {
  it('answers ping for the page that holds the token', async () => {
    const res = await fetch(`${endpoint()}/ping`, { headers: { [DEV_TOKEN_HEADER]: TOKEN } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, backend: 'local-disk' });
  });

  it('passes other URLs to the next middleware', async () => {
    const res = await fetch(`${origin}${BASE}platform/editor`);
    expect(await res.text()).toBe('next');
  });

  it('writes the page, regenerates index/manifest, prepends log.md and creates no commit', async () => {
    const before = await commitCount();
    const b = backend();
    const page = await b.readPage('current', 'systems/index.md');
    const intro = page.text.replace(/\n\n/, '\n\nEdited from the dev server.\n\n');
    const res = await b.writePage('current', 'systems/index.md', intro, { message: 'Update systems intro', author, expectedEtag: page.etag });
    expect(res.commitSha).toBe('');
    expect(await readFile(path.join(siteDir, 'docs', 'systems', 'index.md'), 'utf8')).toContain('Edited from the dev server.');

    const concept = (await b.listPages('current'))[0]!;
    const cp2 = await b.readPage('current', concept.path);
    const edited = cp2.text.replace(/description: .*/, 'description: Changed on the dev server for the test.');
    const res2 = await b.writePage('current', concept.path, edited, { message: 'Dev edit', author, expectedEtag: cp2.etag });
    expect(res2.regenerated).toEqual(expect.arrayContaining(['manifest.json', 'log.md']));
    expect(await readFile(path.join(siteDir, 'docs', 'manifest.json'), 'utf8')).toContain('Changed on the dev server for the test.');
    expect(await readFile(path.join(siteDir, 'docs', 'log.md'), 'utf8')).toContain('Dev edit. (by Dev)');
    expect(await commitCount()).toBe(before);
    expect(await git(repo, 'status', '--porcelain')).toContain('site/docs/manifest.json');
  });

  it('refuses a missing or wrong token', async () => {
    await expect(backend(null).listVersions()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(backend('b'.repeat(64)).listVersions()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(backend('short').listVersions()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await fetch(`${endpoint()}/ping`)).status).toBe(403);
  });

  it('refuses requests from another machine, a foreign Host, a foreign Origin or a non-JSON body', async () => {
    expect((await rpc({ 'x-test-remote': '192.168.1.5' })).status).toBe(403);
    expect((await rpc({ Host: 'evil.example' })).status).toBe(403);
    expect((await rpc({ Host: 'localhost.evil.example' })).status).toBe(403);
    expect((await rpc({ Origin: 'https://evil.example' })).status).toBe(403);
    expect((await rpc({ Origin: 'null' })).status).toBe(403);
    expect((await rpc({ 'Content-Type': 'text/plain' })).status).toBe(403);
    expect((await rpc({})).status).toBe(200);
    expect((await rpc({ Origin: origin })).status).toBe(200);
    expect(logs.some((l) => l.includes('evil.example'))).toBe(true);
  });

  it('never reads or writes outside the bundle', async () => {
    const b = backend();
    for (const p of ['../package.json', 'docs/../../x.md', '.hidden/x.md', '..\\..\\package.json', '/etc/passwd.md', 'C:/x.md']) {
      await expect(b.readPage('current', p), p).rejects.toMatchObject({ code: 'VALIDATION' });
    }
    await expect(b.readPage('../..', 'package.md')).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(b.createPage('current', '../escape.md', '---\ntitle: x\n---\n', { message: 'x', author })).rejects.toMatchObject({ code: 'VALIDATION' });
    for (const p of ['../x.png', 'uploads/../../x.png', 'uploads\\..\\..\\x.png', '.hidden.png']) {
      await expect(b.uploadAsset(p, new Uint8Array([1]), { message: 'x', author }), p).rejects.toMatchObject({ code: 'VALIDATION' });
    }
    expect(await readFile(path.join(repo, 'package.json'), 'utf8')).toBe('{"name":"outside"}\n');
  });

  it('does not serve publishVersion', async () => {
    await expect(backend().publishVersion('9.9.9', { message: 'x', author })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await git(repo, 'tag', '--list')).toBe('');
  });

  it('reports CONFLICT when the file changed on disk after it was loaded', async () => {
    const b = backend();
    const page = await b.readPage('current', 'getting-started.md');
    await writeFile(path.join(siteDir, 'docs', 'getting-started.md'), `${page.text}\nChanged in the IDE.\n`);
    await expect(b.writePage('current', 'getting-started.md', `${page.text}\nMine.\n`, { message: 'x', author, expectedEtag: page.etag })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await readFile(path.join(siteDir, 'docs', 'getting-started.md'), 'utf8')).toContain('Changed in the IDE.');
  });

  it('reads and writes a page comments file under site/comments, with no commit; the same guards apply', async () => {
    const store = new HttpCommentStore(endpoint(), withToken(TOKEN));
    const page = 'systems/inventory.md';
    const before = await commitCount();
    const empty = await store.read(page);
    expect(empty).toEqual({ file: { schema: 1, page, threads: [] }, etag: null });
    const thread = { id: 'c1', body: 'Why?', author: { login: 'dev', name: 'Dev' }, createdAt: '2026-10-09T10:00:00.000Z', status: 'open' as const, replies: [], anchor: { exact: 'stored', prefix: '', suffix: '', tab: null } };
    const res = await store.write(page, { schema: 1, page, threads: [thread] }, { message: 'Comment', author, expectedEtag: null });
    expect(res.commitSha).toBe('');
    expect(JSON.parse(await readFile(path.join(siteDir, 'comments', 'systems', 'inventory.json'), 'utf8')).threads[0].body).toBe('Why?');
    expect(await commitCount()).toBe(before);
    await expect(new HttpCommentStore(endpoint(), withToken(null)).read(page)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(store.read('../package.md')).rejects.toMatchObject({ code: 'VALIDATION' });
    const body = { method: 'read', args: [page] };
    expect((await rpc({ Host: 'evil.example' }, body, 'comments')).status).toBe(403);
    expect((await rpc({ Origin: 'https://evil.example' }, body, 'comments')).status).toBe(403);
    expect((await rpc({ 'Content-Type': 'text/plain' }, body, 'comments')).status).toBe(403);
    expect((await rpc({ 'x-test-remote': '10.0.0.2' }, body, 'comments')).status).toBe(403);
    expect((await rpc({}, body, 'comments')).status).toBe(200);
    expect((await fetch(`${endpoint()}/comments`, { headers: { [DEV_TOKEN_HEADER]: TOKEN } })).status).toBe(405);
  });

  it('passes unknown routes under the endpoint to the next middleware', async () => {
    expect(await (await fetch(`${endpoint()}/constructor`)).text()).toBe('next');
    expect(await (await fetch(`${endpoint()}/rpc/x`)).text()).toBe('next');
  });
});
