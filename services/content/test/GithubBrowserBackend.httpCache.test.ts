import { describe, it, expect } from 'vitest';
import { MINI_BUNDLE, MINI_CODE_REPOS } from '@platform/contracts/testing';
import { GithubBrowserBackend, GitDataClient } from '../src/index.js';
import { FakeGitHub } from './FakeGitHub.js';

// GitHub answers GETs with `Cache-Control: private, max-age=60`, and browsers honour it: a second GET of
// the branch ref within a minute comes from the HTTP cache. This fetch behaves like that browser cache
// (every GET is cached unless the request opts out with cache: 'no-store' / 'no-cache' / 'reload').

const author = { name: 'Mira', email: 'mira@example.com' };
const urlOf = (input: Parameters<typeof fetch>[0]): string => (typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

function browserCachingFetch(inner: typeof fetch): typeof fetch {
  const cache = new Map<string, Response>();
  return async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const bypass = init?.cache === 'no-store' || init?.cache === 'no-cache' || init?.cache === 'reload';
    const key = urlOf(input);
    if (method === 'GET' && !bypass && cache.has(key)) return cache.get(key)!.clone();
    const res = await inner(input, init);
    if (method === 'GET' && res.ok && init?.cache !== 'no-store') cache.set(key, res.clone());
    return res;
  };
}

function setup() {
  const gh = new FakeGitHub('acme', 'docs');
  const files: Record<string, string> = { 'site/versions.json': '[]\n' };
  for (const [rel, text] of Object.entries(MINI_BUNDLE)) files[`site/docs/${rel}`] = text;
  gh.seed('main', files);
  return gh;
}
const backend = (f: typeof fetch) => new GithubBrowserBackend({ owner: 'acme', repo: 'docs', branch: 'main', sitePath: 'site', codeRepos: MINI_CODE_REPOS, token: 't', fetch: f });

describe('GithubBrowserBackend behind a browser HTTP cache', () => {
  it('reads the page as just saved when editing again right after a save', async () => {
    const gh = setup();
    const b = backend(browserCachingFetch(gh.fetch));
    const page = await b.readPage('current', 'systems/inventory.md');
    await b.writePage('current', 'systems/inventory.md', `${page.text}\nFirst.\n`, { message: 'first', author, expectedEtag: page.etag });
    const again = await b.readPage('current', 'systems/inventory.md');
    expect(again.text).toContain('First.');
    await b.writePage('current', 'systems/inventory.md', `${again.text}Second.\n`, { message: 'second', author, expectedEtag: again.etag });
    expect(gh.fileAt('main', 'site/docs/systems/inventory.md')).toContain('Second.');
  });

  it('saves on top of a commit that landed after the page was opened (no stale head)', async () => {
    const gh = setup();
    const b = backend(browserCachingFetch(gh.fetch));
    const page = await b.readPage('current', 'systems/inventory.md');
    const other = new GitDataClient({ owner: 'acme', repo: 'docs', token: 't', fetch: gh.fetch });
    await other.commitFiles('main', { 'other.txt': 'x' }, [], 'someone else', author);
    await b.writePage('current', 'systems/inventory.md', `${page.text}\nMine.\n`, { message: 'mine', author, expectedEtag: page.etag });
    expect(gh.fileAt('main', 'site/docs/systems/inventory.md')).toContain('Mine.');
    expect(gh.fileAt('main', 'other.txt')).toBe('x');
  });
});
