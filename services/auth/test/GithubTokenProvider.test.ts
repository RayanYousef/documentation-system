import { describe, it, expect } from 'vitest';
import { describeAuthProviderContract } from '@platform/contracts/testing';
import { GithubTokenProvider } from '../src/index.js';
import { fakeGithubFetch } from './fakeGithubAuth.js';

const users = {
  'ghp_writer': { login: 'rayan', name: 'Rayan Yousef', email: null, push: true },
  'ghp_reader': { login: 'guest', name: 'Guest', email: 'g@example.com', push: false },
  // A fine-grained token without Contents: write: the repo says push (the owner's role), the write is refused.
  'ghp_noContents': { login: 'rayan', name: 'Rayan Yousef', email: null, push: true, write: false },
};
const make = () => new GithubTokenProvider({ owner: 'RayanYousef', repo: 'documentation-system', fetch: fakeGithubFetch(users) });

describeAuthProviderContract('GithubTokenProvider', async () => ({
  provider: make(),
  validCredentials: { kind: 'github-token', token: 'ghp_writer' },
  invalidCredentials: { kind: 'github-token', token: 'ghp_nope' },
  nonCollaboratorCredentials: { kind: 'github-token', token: 'ghp_reader' },
}));

describe('GithubTokenProvider specifics', () => {
  it('names the repo in the NOT_COLLABORATOR message and sets role editor for writers', async () => {
    const p = make();
    await expect(p.login({ kind: 'github-token', token: 'ghp_reader' })).rejects.toThrow('You are not a write collaborator of RayanYousef/documentation-system');
    const id = await p.verify(await p.login({ kind: 'github-token', token: 'ghp_writer' }));
    expect(id).toEqual({ name: 'Rayan Yousef', login: 'rayan', email: null, role: 'editor' });
  });
  it('sends the token as a Bearer header with the GitHub API version', async () => {
    let seen: Record<string, string> | undefined;
    const spy: typeof fetch = async (input, init) => { seen = init?.headers as Record<string, string>; return fakeGithubFetch(users)(input, init); };
    await new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: spy }).login({ kind: 'github-token', token: 'ghp_writer' });
    expect(seen).toMatchObject({ Authorization: 'Bearer ghp_writer', 'X-GitHub-Api-Version': '2022-11-28' });
  });

  describe('write check at sign-in', () => {
    it('refuses a token that can read the repo but cannot write, with the fix in the message', async () => {
      await expect(make().login({ kind: 'github-token', token: 'ghp_noContents' })).rejects.toMatchObject({
        name: 'AuthError',
        code: 'CANNOT_WRITE',
        message: 'This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write.',
      });
    });
    it('probes with exactly one POST /git/blobs of a tiny unreferenced blob', async () => {
      const calls: string[] = [];
      let probeBody = '';
      const spy: typeof fetch = async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input).replace('https://api.github.com', '')}`);
        if (init?.method === 'POST') probeBody = String(init.body);
        return fakeGithubFetch(users)(input, init);
      };
      await new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: spy }).login({ kind: 'github-token', token: 'ghp_writer' });
      expect(calls.filter((c) => c.startsWith('POST'))).toEqual(['POST /repos/o/r/git/blobs']);
      expect(probeBody.length).toBeLessThan(100);
    });
    it('a network error during the probe is a NETWORK error, not "cannot write"', async () => {
      const flaky: typeof fetch = async (input, init) => { if (init?.method === 'POST') throw new TypeError('offline'); return fakeGithubFetch(users)(input, init); };
      await expect(new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: flaky }).login({ kind: 'github-token', token: 'ghp_writer' })).rejects.toMatchObject({ code: 'NETWORK' });
    });
    it('a rejected probe token (401) is INVALID_CREDENTIALS', async () => {
      const revoked: typeof fetch = async (input, init) => init?.method === 'POST' ? new Response('{}', { status: 401 }) : fakeGithubFetch(users)(input, init);
      await expect(new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: revoked }).login({ kind: 'github-token', token: 'ghp_writer' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
    it('a rate-limited probe (403 with rate-limit headers or text) is not "cannot write"; it says to wait', async () => {
      const limits: Record<string, string>[] = [{ 'retry-after': '60' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) }];
      for (const headers of limits) {
        const limited: typeof fetch = async (input, init) => init?.method === 'POST' ? new Response(JSON.stringify({ message: 'API rate limit exceeded' }), { status: 403, headers }) : fakeGithubFetch(users)(input, init);
        const e = await new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: limited }).login({ kind: 'github-token', token: 'ghp_writer' }).catch((x: unknown) => x);
        expect(e, JSON.stringify(headers)).toMatchObject({ name: 'AuthError', code: 'NETWORK' });
        expect((e as Error).message).toMatch(/rate limit/i);
        expect((e as Error).message).not.toMatch(/cannot write/);
      }
      const secondary: typeof fetch = async (input, init) => init?.method === 'POST' ? new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' }), { status: 403 }) : fakeGithubFetch(users)(input, init);
      await expect(new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: secondary }).login({ kind: 'github-token', token: 'ghp_writer' })).rejects.toMatchObject({ code: 'NETWORK' });
    });
    it('a rate-limited verify of a remembered session is NETWORK (the token is kept), not INVALID_CREDENTIALS', async () => {
      const limited: typeof fetch = async () => new Response(JSON.stringify({ message: 'API rate limit exceeded for user ID 1.' }), { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
      const p = new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: limited });
      await expect(p.verify({ provider: 'github-token', token: 'ghp_writer', createdAt: new Date().toISOString() })).rejects.toMatchObject({ code: 'NETWORK' });
    });
    it('a plain 403 on the probe (no rate-limit sign) is still "cannot write"', async () => {
      const plain: typeof fetch = async (input, init) => init?.method === 'POST' ? new Response(JSON.stringify({ message: 'Resource not accessible by personal access token' }), { status: 403 }) : fakeGithubFetch(users)(input, init);
      await expect(new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: plain }).login({ kind: 'github-token', token: 'ghp_writer' })).rejects.toMatchObject({ code: 'CANNOT_WRITE' });
    });
    it('verify of a remembered session does not write', async () => {
      let posts = 0;
      const spy: typeof fetch = async (input, init) => { if (init?.method === 'POST') posts++; return fakeGithubFetch(users)(input, init); };
      const p = new GithubTokenProvider({ owner: 'o', repo: 'r', fetch: spy });
      const s = await p.login({ kind: 'github-token', token: 'ghp_writer' });
      posts = 0;
      await p.verify(s);
      expect(posts).toBe(0);
    });
  });
});
