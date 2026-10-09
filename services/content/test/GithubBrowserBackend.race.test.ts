import { describe, it, expect } from 'vitest';
import { MINI_BUNDLE, MINI_CODE_REPOS } from '@platform/contracts/testing';
import { generateBundle } from '@platform/okf-core';
import { GithubBrowserBackend, GitDataClient } from '../src/index.js';
import { FakeGitHub } from './FakeGitHub.js';

const author = { name: 'Mira', email: 'mira@example.com' };
const urlOf = (input: Parameters<typeof fetch>[0]): string => (typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

function setup() {
  const gh = new FakeGitHub('acme', 'docs');
  const files: Record<string, string> = { 'site/versions.json': '[]\n' };
  for (const [rel, text] of Object.entries(MINI_BUNDLE)) files[`site/docs/${rel}`] = text;
  gh.seed('main', files);
  return gh;
}
const backend = (f: typeof fetch) => new GithubBrowserBackend({ owner: 'acme', repo: 'docs', branch: 'main', sitePath: 'site', codeRepos: MINI_CODE_REPOS, token: 't', fetch: f });

/** The docs bundle on main, bundle-relative. */
function bundleOnMain(gh: FakeGitHub): Record<string, string> {
  const head = gh.commits.get(gh.refs.get('heads/main')!)!;
  const out: Record<string, string> = {};
  for (const [p, sha] of Object.entries(gh.trees.get(head.tree)!)) if (p.startsWith('site/docs/')) out[p.slice('site/docs/'.length)] = new TextDecoder().decode(gh.blobs.get(sha)!);
  return out;
}

describe('GitDataClient.commitFiles with an expected parent', () => {
  it('refuses to move the branch when it moved since the snapshot (branch-moved)', async () => {
    const gh = setup();
    const git = new GitDataClient({ owner: 'acme', repo: 'docs', token: 't', fetch: gh.fetch });
    const head = await git.getHead('main');
    await git.commitFiles('main', { 'other.txt': 'x' }, [], 'other', author);
    await expect(git.commitFiles('main', { 'mine.txt': 'y' }, [], 'mine', author, { expectedParent: head })).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'branch-moved' } });
    expect(gh.fileAt('main', 'mine.txt')).toBeNull();
    expect(gh.fileAt('main', 'other.txt')).toBe('x');
  });

  it('commits on top of the expected parent when the branch did not move', async () => {
    const gh = setup();
    const git = new GitDataClient({ owner: 'acme', repo: 'docs', token: 't', fetch: gh.fetch });
    const head = await git.getHead('main');
    const sha = await git.commitFiles('main', { 'mine.txt': 'y' }, [], 'mine', author, { expectedParent: head });
    expect(gh.commits.get(sha)!.parents).toEqual([head.commitSha]);
    expect(gh.fileAt('main', 'mine.txt')).toBe('y');
  });
});

describe('GithubBrowserBackend concurrent saves', () => {
  it('re-plans on top of the new head so generated files include both changes', async () => {
    const gh = setup();
    const bob = backend(gh.fetch);
    const alice = backend(gh.fetch);
    const inv = await alice.readPage('current', 'systems/inventory.md');
    const gs = await bob.readPage('current', 'getting-started.md');

    // Bob's save lands while Alice's save is between its snapshot and its commit.
    let injected = false;
    const racingFetch: typeof fetch = async (input, init) => {
      if (!injected && init?.method === 'POST' && urlOf(input).endsWith('/git/blobs')) {
        injected = true;
        await bob.writePage('current', 'getting-started.md', gs.text.replace(/description: .*/, 'description: Read this first when you join the project.'), { message: 'Bob edit', author, expectedEtag: gs.etag });
      }
      return gh.fetch(input, init);
    };
    const res = await backend(racingFetch).writePage('current', 'systems/inventory.md', inv.text.replace('Explains how items are stored', 'Explains how stacks are stored'), { message: 'Alice edit', author, expectedEtag: inv.etag });
    expect(injected).toBe(true);
    const manifest = gh.fileAt('main', 'site/docs/manifest.json')!;
    expect(manifest).toContain('Explains how stacks are stored');
    expect(manifest).toContain('Read this first when you join the project.');
    expect(gh.commits.get(res.commitSha)!.message).toBe('Alice edit');
    expect(gh.fileAt('main', 'site/docs/log.md')).toMatch(/Alice edit[\s\S]*Bob edit|Bob edit[\s\S]*Alice edit/);
    // Nothing stale: regenerating the bundle on main changes nothing.
    const files = bundleOnMain(gh);
    const gen = generateBundle(files, { codeRepos: MINI_CODE_REPOS });
    expect(gen.problems).toEqual([]);
    for (const [p, text] of Object.entries(gen.writes)) expect(text, p).toBe(files[p]);
  });

  it('still reports a real edit conflict when the same page changed', async () => {
    const gh = setup();
    const a = backend(gh.fetch);
    const page = await a.readPage('current', 'systems/inventory.md');
    await a.writePage('current', 'systems/inventory.md', page.text + '\nFirst.\n', { message: 'first', author, expectedEtag: page.etag });
    await expect(a.writePage('current', 'systems/inventory.md', page.text + '\nSecond.\n', { message: 'second', author, expectedEtag: page.etag })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('uploads an asset even when another commit lands between reading the head and moving the branch', async () => {
    const gh = setup();
    const other = new GitDataClient({ owner: 'acme', repo: 'docs', token: 't', fetch: gh.fetch });
    let injected = false;
    const racingFetch: typeof fetch = async (input, init) => {
      if (!injected && init?.method === 'PATCH' && urlOf(input).includes('/git/refs/heads/')) {
        injected = true;
        await other.commitFiles('main', { 'other.txt': 'x' }, [], 'someone else', author);
      }
      return gh.fetch(input, init);
    };
    const res = await backend(racingFetch).uploadAsset('models/ship.glb', new Uint8Array([1, 2, 3]), { message: 'Upload ship', author });
    expect(injected).toBe(true);
    expect(res.asset.path).toBe('models/ship.glb');
    expect(gh.fileAt('main', 'other.txt')).toBe('x');
    expect(gh.fileAt('main', 'site/static/models/ship.glb')).not.toBeNull();
  });

  it('gives up with CONFLICT after two retries when the branch keeps moving', async () => {
    const gh = setup();
    const other = new GitDataClient({ owner: 'acme', repo: 'docs', token: 't', fetch: gh.fetch });
    let n = 0;
    const alwaysRacing: typeof fetch = async (input, init) => {
      if (init?.method === 'PATCH' && urlOf(input).includes('/git/refs/heads/')) {
        n++;
        await other.commitFiles('main', { [`noise-${n}.txt`]: 'x' }, [], 'noise', author);
      }
      return gh.fetch(input, init);
    };
    const b = backend(alwaysRacing);
    const page = await b.readPage('current', 'systems/inventory.md');
    await expect(b.writePage('current', 'systems/inventory.md', page.text + '\nx\n', { message: 'x', author, expectedEtag: page.etag })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(n).toBe(3);
  });
});
