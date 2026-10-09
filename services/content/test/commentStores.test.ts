import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { describe, it, expect } from 'vitest';
import { describeCommentStoreContract } from '@platform/contracts/testing';
import { ContentError, type CommentsFile } from '@platform/contracts';
import { GithubCommentStore, HttpCommentStore, LocalCommentStore, WorkingTreeCommitter, createCommentRpcHandler, commentsFilePath, git, serializeCommentsFile } from '../src/node.js';
import { GitDataClient } from '../src/index.js';
import { FakeGitHub } from './FakeGitHub.js';

const author = { name: 'Other', email: 'other@example.com' };

function githubHarness() {
  const gh = new FakeGitHub('acme', 'docs');
  gh.seed('main', { 'site/docs/systems/inventory.md': '# Inventory\n' });
  const store = new GithubCommentStore({ owner: 'acme', repo: 'docs', branch: 'main', sitePath: 'site', token: 'ghp_test', fetch: gh.fetch });
  const other = new GitDataClient({ owner: 'acme', repo: 'docs', token: null, fetch: gh.fetch });
  return {
    gh,
    store,
    readFile: async (rel: string) => gh.fileAt('main', `site/${rel}`),
    writeBehind: async (page: string, file: CommentsFile | null) => {
      const p = `site/${commentsFilePath(page)}`;
      await other.commitFiles('main', file ? { [p]: serializeCommentsFile(file) } : {}, file ? [] : [p], 'Someone else', author);
    },
  };
}

async function localHarness(committer?: WorkingTreeCommitter) {
  const repo = await mkdtemp(path.join(tmpdir(), 'comments-'));
  const siteDir = path.join(repo, 'site');
  await mkdir(path.join(siteDir, 'docs'), { recursive: true });
  await writeFile(path.join(siteDir, 'docs', 'index.md'), '# Home\n');
  await git(repo, 'init', '-q', '-b', 'main');
  await git(repo, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'add', '-A');
  await git(repo, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'commit', '-q', '-m', 'seed');
  const abs = (rel: string) => path.join(siteDir, ...rel.split('/'));
  return {
    repo,
    siteDir,
    store: new LocalCommentStore({ siteDir, committer }),
    readFile: (rel: string) => readFile(abs(rel), 'utf8').catch(() => null),
    writeBehind: async (page: string, file: CommentsFile | null) => {
      const p = abs(commentsFilePath(page));
      if (!file) { await rm(p, { force: true }); return; }
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, serializeCommentsFile(file));
    },
    cleanup: () => rm(repo, { recursive: true, force: true }),
  };
}

describeCommentStoreContract('GithubCommentStore', async () => githubHarness());
describeCommentStoreContract('LocalCommentStore (git commit)', async () => localHarness());
describeCommentStoreContract('LocalCommentStore (working tree)', async () => localHarness(new WorkingTreeCommitter()), { commits: false });
describeCommentStoreContract('HttpCommentStore over LocalCommentStore', async () => {
  const local = await localHarness(new WorkingTreeCommitter());
  const handler = createCommentRpcHandler(local.store);
  const server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    ...local,
    store: new HttpCommentStore(url),
    cleanup: async () => { await new Promise<void>((r) => server.close(() => r())); await local.cleanup(); },
  };
}, { commits: false });

const file = (page: string, body: string): CommentsFile => ({
  schema: 1, page, threads: [{ id: 'c1', body, author: { login: 'mira', name: 'Mira' }, createdAt: '2026-10-09T10:00:00.000Z', status: 'open', replies: [], anchor: { exact: 'Inventory', prefix: '', suffix: '', tab: null } }],
});

describe('GithubCommentStore', () => {
  it('commits one file under site/comments with the editor as author, and no docs file changes', async () => {
    const { gh, store } = githubHarness();
    const before = gh.fileAt('main', 'site/docs/systems/inventory.md');
    const res = await store.write('systems/inventory.md', file('systems/inventory.md', 'Hi'), { message: 'Comment on systems/inventory.md', author: { name: 'Mira', email: 'mira@example.com' }, expectedEtag: null });
    expect(gh.commits.get(res.commitSha)).toMatchObject({ message: 'Comment on systems/inventory.md', author: { name: 'Mira', email: 'mira@example.com' } });
    expect(res.commitUrl).toBe(`https://github.com/acme/docs/commit/${res.commitSha}`);
    expect(gh.fileAt('main', 'site/docs/systems/inventory.md')).toBe(before);
  });

  it('commits on top of an unrelated commit that landed meanwhile (branch moved), once the comments file is unchanged', async () => {
    const { gh, store } = githubHarness();
    let raced = false;
    const racing: typeof fetch = async (input, init) => {
      if (!raced && init?.method === 'PATCH') {
        raced = true;
        await new GitDataClient({ owner: 'acme', repo: 'docs', token: null, fetch: gh.fetch }).commitFiles('main', { 'site/docs/other.md': 'x' }, [], 'Other save', author);
      }
      return gh.fetch(input, init);
    };
    const racy = new GithubCommentStore({ owner: 'acme', repo: 'docs', branch: 'main', sitePath: 'site', token: 't', fetch: racing });
    await racy.write('systems/inventory.md', file('systems/inventory.md', 'Hi'), { message: 'Comment', author, expectedEtag: null });
    expect(gh.fileAt('main', 'site/docs/other.md')).toBe('x');
    expect(JSON.parse(gh.fileAt('main', 'site/comments/systems/inventory.json')!).threads[0].body).toBe('Hi');
    void store;
  });

  it('reports a corrupt file as VALIDATION', async () => {
    const { store, writeBehind, gh } = githubHarness();
    await writeBehind('systems/inventory.md', file('systems/inventory.md', 'x'));
    await new GitDataClient({ owner: 'acme', repo: 'docs', token: null, fetch: gh.fetch }).commitFiles('main', { 'site/comments/systems/inventory.json': '{nope' }, [], 'break', author);
    await expect(store.read('systems/inventory.md')).rejects.toBeInstanceOf(ContentError);
    await expect(store.read('systems/inventory.md')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('createCommentRpcHandler', () => {
  it('refuses methods other than read and write, and malformed write options', async () => {
    const local = await localHarness(new WorkingTreeCommitter());
    const handler = createCommentRpcHandler(local.store);
    const server = createServer((req, res) => void handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      const call = (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const bad = await call({ method: 'constructor', args: [] });
      expect(bad.status).toBe(403);
      const noOpts = await (await call({ method: 'write', args: ['index.md', file('index.md', 'x')] })).json();
      expect(noOpts.error).toMatchObject({ code: 'VALIDATION' });
      expect(await local.readFile('comments/index.json')).toBeNull();
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
      await local.cleanup();
    }
  });
});
