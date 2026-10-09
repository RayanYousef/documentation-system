import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describeContentBackendContract, MINI_CODE_REPOS } from '@platform/contracts/testing';
import { ContentError } from '@platform/contracts';
import { GitCommitter, WorkingTreeCommitter, LocalFolderBackend, git } from '../src/node.js';
import { makeLocalHarness } from './localHarness.js';

const author = { name: 'Mira', email: 'mira@example.com' };

async function tempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'committer-'));
  await git(dir, 'init', '-q', '-b', 'main');
  await writeFile(path.join(dir, 'a.txt'), 'a\n');
  await git(dir, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'add', '-A');
  await git(dir, '-c', 'user.name=seed', '-c', 'user.email=seed@example.com', 'commit', '-q', '-m', 'seed');
  return dir;
}
const commitCount = async (dir: string) => Number(await git(dir, 'rev-list', '--count', 'HEAD'));

describe('GitCommitter', () => {
  it('commits every working-tree change with the author and returns the sha', async () => {
    const dir = await tempRepo();
    await writeFile(path.join(dir, 'b.txt'), 'b\n');
    const sha = await new GitCommitter().commit(dir, 'Add b', author);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await git(dir, 'log', '-1', '--format=%an %s')).toBe('Mira Add b');
    await new GitCommitter().tag(dir, 'v1', sha);
    expect(await git(dir, 'tag', '--list')).toBe('v1');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('WorkingTreeCommitter', () => {
  it('leaves changes in the working tree and creates no commit', async () => {
    const dir = await tempRepo();
    await writeFile(path.join(dir, 'b.txt'), 'b\n');
    const before = await commitCount(dir);
    await expect(new WorkingTreeCommitter().commit(dir, 'Add b', author)).resolves.toBe('');
    expect(await commitCount(dir)).toBe(before);
    expect(await git(dir, 'status', '--porcelain')).toContain('b.txt');
    await rm(dir, { recursive: true, force: true });
  });

  it('refuses to tag (publishing needs a commit)', async () => {
    await expect(new WorkingTreeCommitter().tag('.', 'v1', '')).rejects.toBeInstanceOf(ContentError);
    await expect(new WorkingTreeCommitter().tag('.', 'v1', '')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describeContentBackendContract('LocalFolderBackend + WorkingTreeCommitter', async () => {
  const h = await makeLocalHarness();
  return { ...h, backend: new LocalFolderBackend({ siteDir: h.siteDir, codeRepos: MINI_CODE_REPOS, committer: new WorkingTreeCommitter(), resolveRef: async () => 'b'.repeat(40) }) };
}, { commits: false, publishes: false });

describe('LocalFolderBackend + WorkingTreeCommitter', () => {
  it('writes the page and regenerated files without committing', async () => {
    const h = await makeLocalHarness();
    const backend = new LocalFolderBackend({ siteDir: h.siteDir, codeRepos: MINI_CODE_REPOS, committer: new WorkingTreeCommitter() });
    const repo = path.dirname(h.siteDir);
    const before = await commitCount(repo);
    const page = await backend.readPage('current', 'systems/inventory.md');
    const res = await backend.writePage('current', 'systems/inventory.md', page.text.replace('Explains how items are stored', 'Explains how stacks are stored'), { message: 'Edit', author, expectedEtag: page.etag });
    expect(res.commitSha).toBe('');
    expect(await commitCount(repo)).toBe(before);
    expect(await h.readFile('docs/manifest.json')).toContain('Explains how stacks are stored');
    expect(await git(repo, 'status', '--porcelain')).toContain('site/docs/systems/inventory.md');
    await h.cleanup?.();
  });

  it('refuses publishVersion with FORBIDDEN and leaves no commit or tag', async () => {
    const h = await makeLocalHarness();
    const backend = new LocalFolderBackend({ siteDir: h.siteDir, codeRepos: MINI_CODE_REPOS, committer: new WorkingTreeCommitter(), resolveRef: async () => 'b'.repeat(40) });
    await expect(backend.publishVersion('1.1.0', { message: 'p', author })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await h.listTags()).toEqual([]);
    await h.cleanup?.();
  });
});
