import { describe, it, expect } from 'vitest';
import { ContentError } from '@platform/contracts';
import { GitDataClient } from '../src/github/gitData.js';

const author = { name: 'A', email: 'a@example.com' };

/** A GitHub that answers every request with the given response (a bare failure at one endpoint). */
function clientAnswering(res: { status: number; body?: unknown; headers?: Record<string, string> }, onlyWhen: (method: string, path: string) => boolean = () => true): GitDataClient {
  const f: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    if (onlyWhen(method, url.pathname)) return new Response(JSON.stringify(res.body ?? {}), { status: res.status, headers: { 'content-type': 'application/json', ...res.headers } });
    // Everything before the failing call works: head, tree, blob.
    if (method === 'GET' && url.pathname.includes('/git/ref/')) return new Response(JSON.stringify({ object: { sha: 'c'.repeat(40) } }), { status: 200 });
    if (method === 'GET' && url.pathname.includes('/git/commits/')) return new Response(JSON.stringify({ tree: { sha: 't'.repeat(40) } }), { status: 200 });
    return new Response(JSON.stringify({ sha: 'b'.repeat(40) }), { status: 201 });
  };
  return new GitDataClient({ owner: 'o', repo: 'r', token: 'tok', fetch: f });
}
const save = (c: GitDataClient) => c.commitFiles('main', { 'a.md': 'x' }, [], 'msg', author);
const reason = (e: unknown) => (e as ContentError).details as { reason: string; retryAfterSeconds?: number };

describe('GitDataClient failures read like instructions, not HTTP codes', () => {
  it('401 means the token expired or was revoked', async () => {
    const e = await save(clientAnswering({ status: 401, body: { message: 'Bad credentials' } })).catch((x: unknown) => x) as ContentError;
    expect(e).toBeInstanceOf(ContentError);
    expect(e.code).toBe('FORBIDDEN');
    expect(e.message).toMatch(/token has expired or was revoked/i);
    expect(e.message).not.toMatch(/HTTP 40/);
    expect(reason(e).reason).toBe('token-expired');
  });

  it('403 on a write means the token cannot write, and says how to fix it', async () => {
    const e = await save(clientAnswering({ status: 403, body: { message: 'Resource not accessible by personal access token' } }, (m, p) => m === 'POST' && p.endsWith('/git/blobs'))).catch((x: unknown) => x) as ContentError;
    expect(e.code).toBe('FORBIDDEN');
    expect(e.message).toContain('cannot write');
    expect(e.message).toContain('Contents: Read and write');
    expect(reason(e).reason).toBe('cannot-write');
  });

  it('403 with x-ratelimit-remaining: 0 is a rate limit with the wait time', async () => {
    const reset = Math.floor(Date.now() / 1000) + 125;
    const e = await save(clientAnswering({ status: 403, body: { message: 'API rate limit exceeded' }, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } })).catch((x: unknown) => x) as ContentError;
    expect(reason(e).reason).toBe('rate-limited');
    expect(e.message).toMatch(/rate limit/i);
    expect(e.message).toMatch(/about (2|3) minutes?|1\d\d seconds|2 minutes/i);
    expect(reason(e).retryAfterSeconds).toBeGreaterThan(100);
  });

  it('429 with retry-after is a rate limit that waits that long', async () => {
    const e = await save(clientAnswering({ status: 429, headers: { 'retry-after': '45' } })).catch((x: unknown) => x) as ContentError;
    expect(reason(e).reason).toBe('rate-limited');
    expect(reason(e).retryAfterSeconds).toBe(45);
    expect(e.message).toContain('45 seconds');
  });

  it('a 403 whose text says "secondary rate limit" is a rate limit even without headers', async () => {
    const e = await save(clientAnswering({ status: 403, body: { message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' } })).catch((x: unknown) => x) as ContentError;
    expect(reason(e).reason).toBe('rate-limited');
    expect(e.message).toMatch(/wait/i);
  });

  it('protected branch refusals (403 or 422 with the protected-branch text) name the branch', async () => {
    for (const status of [403, 422]) {
      const e = await save(clientAnswering({ status, body: { message: 'Protected branch update failed for refs/heads/main.' } }, (m) => m === 'PATCH')).catch((x: unknown) => x) as ContentError;
      expect(e.code, String(status)).toBe('FORBIDDEN');
      expect(reason(e).reason).toBe('branch-protected');
      expect(e.message).toContain('"main" is protected');
    }
  });

  it('a plain 422 on the ref update is still a CONFLICT (the branch moved)', async () => {
    const e = await save(clientAnswering({ status: 422, body: { message: 'Update is not a fast forward' } }, (m) => m === 'PATCH')).catch((x: unknown) => x) as ContentError;
    expect(e.code).toBe('CONFLICT');
  });

  it('403 on a read says the token cannot read the repository', async () => {
    const e = await clientAnswering({ status: 403 }).getHead('main').catch((x: unknown) => x) as ContentError;
    expect(e.code).toBe('FORBIDDEN');
    expect(e.message).toMatch(/cannot read/);
  });
});
