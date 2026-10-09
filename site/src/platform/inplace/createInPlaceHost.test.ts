import { describe, it, expect, vi } from 'vitest';
import type { PlatformConfig } from '@platform/contracts';
import { createInPlaceHost, DEV_SESSION_KEY, DEV_TOKEN_HEADER, type HostDeps } from './createInPlaceHost';

const config = {
  baseUrl: '/documentation-system/', organizationName: 'RayanYousef', projectName: 'documentation-system', deployBranch: 'main', sitePath: 'site',
  codeRepos: [{ owner: 'RayanYousef', repo: 'documentation-system', defaultRef: 'main', label: 'x' }],
} as unknown as PlatformConfig;

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

function deps(over: Partial<HostDeps> = {}): HostDeps {
  return {
    config, global: { enabled: true, mode: 'github' }, buildSha: 'sha-1',
    navigation: { block: () => () => {} }, navigate: vi.fn(), onSignedIn: vi.fn(),
    storage: new MemoryStorage() as unknown as Storage, fetch: vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch,
    ...over,
  };
}

describe('createInPlaceHost', () => {
  it('github mode: token sign-in, GitHub backend with the session token, publish allowed', async () => {
    const d = deps();
    const host = await createInPlaceHost(d);
    expect(host.mode).toBe('github');
    expect(host.auth.id).toBe('github-token');
    expect(host.backend({ provider: 'github-token', token: 't', createdAt: '' }).id).toBe('github-browser');
    expect(host.capabilities).toEqual({ publish: true, pageOps: true });
    expect(host.urls.commitUrl('abc')).toBe('https://github.com/RayanYousef/documentation-system/commit/abc');
    expect(host.urls.pageUrl('systems/index.md')).toBe('/documentation-system/systems/');
    expect(host.componentsUrl).toBe('/documentation-system/platform/components.json');
    expect(host.buildSha).toBe('sha-1');
    expect(host.onSignedIn).toBe(d.onSignedIn);
    expect(d.fetch).not.toHaveBeenCalled(); // no dev endpoint to probe
  });

  it('local-disk mode: probes the dev endpoint, then display-name sign-in and the token-carrying HTTP backend', async () => {
    const calls: { url: string; token: string | null }[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, token: new Headers(init?.headers).get(DEV_TOKEN_HEADER) });
      if (url.endsWith('/ping')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(JSON.stringify({ result: [{ id: 'current', label: 'Latest', frozen: false }] }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    const storage = new MemoryStorage();
    const host = await createInPlaceHost(deps({ fetch, storage: storage as unknown as Storage, global: { enabled: true, mode: 'local-disk', endpoint: '/documentation-system/__platform/content', devToken: 'secret' } }));
    expect(host.mode).toBe('local-disk');
    expect(host.auth.id).toBe('mock');
    const backend = host.backend(null);
    expect(backend.id).toBe('http');
    await backend.listVersions();
    expect(calls).toEqual([
      { url: '/documentation-system/__platform/content/ping', token: 'secret' },
      { url: '/documentation-system/__platform/content/rpc', token: 'secret' },
    ]);
    expect(host.capabilities.publish).toBe(false);
    expect(host.urls.commitUrl('abc')).toBeNull();
    expect(host.onSignedIn).toBeUndefined();
    host.sessionStore.save({ provider: 'mock', token: 'mock.x', createdAt: '' }, true);
    expect(storage.getItem(DEV_SESSION_KEY)).toContain('mock.x');
    expect(storage.getItem('docs-platform.session')).toBeNull();
  });

  it('falls back to GitHub when the dev endpoint does not answer (a production build served locally)', async () => {
    const fetch = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof globalThis.fetch;
    const host = await createInPlaceHost(deps({ fetch, global: { enabled: true, mode: 'local-disk', endpoint: '/x/__platform/content', devToken: 's' } }));
    expect(host.mode).toBe('github');
    expect(host.auth.id).toBe('github-token');
  });

  it('falls back to GitHub when the probe throws', async () => {
    const fetch = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof globalThis.fetch;
    const host = await createInPlaceHost(deps({ fetch, global: { enabled: true, mode: 'local-disk', endpoint: '/x/__platform/content', devToken: 's' } }));
    expect(host.mode).toBe('github');
  });
});
