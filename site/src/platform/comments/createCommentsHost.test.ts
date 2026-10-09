import { describe, it, expect, vi } from 'vitest';
import type { CommentEditor } from '@platform/comments';
import type { PlatformConfig } from '@platform/contracts';
import { sharedSessionStore } from '../inplace/sessionStores';
import { createCommentsHost, type CommentsHostDeps } from './createCommentsHost';

const config = { baseUrl: '/documentation-system/', organizationName: 'RayanYousef', projectName: 'documentation-system', deployBranch: 'main', sitePath: 'site' } as unknown as PlatformConfig;

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

function deps(over: Partial<CommentsHostDeps> = {}): CommentsHostDeps & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => new Response(JSON.stringify({ schema: 1, page: 'a.md', threads: [] }), { status: 200 }));
  return {
    config, global: { enabled: true, mode: 'github' }, buildSha: 'sha-1',
    signIn: vi.fn(async () => null), signedInEditor: vi.fn(async () => ({}) as CommentEditor), setTabCounts: vi.fn(),
    storage: new MemoryStorage() as unknown as Storage, sessionStorage: new MemoryStorage() as unknown as Storage,
    fetch, ...over,
  } as CommentsHostDeps & { fetch: ReturnType<typeof vi.fn> };
}

describe('createCommentsHost', () => {
  it('live site: fetches the published file of this build, asking the server every time (never a stale browser copy)', async () => {
    const d = deps();
    await createCommentsHost(d).loadPublished('platform/comments.md');
    expect(d.fetch).toHaveBeenCalledWith('/documentation-system/platform/comments/platform/comments.json?v=sha-1', { cache: 'no-cache' });
  });

  it('dev server: reads the disk every time, no build query', async () => {
    const d = deps({ global: { enabled: true, mode: 'local-disk' } });
    await createCommentsHost(d).loadPublished('platform/comments.md');
    expect(d.fetch).toHaveBeenCalledWith('/documentation-system/platform/comments/platform/comments.json', { cache: 'no-store' });
  });

  it('a reader with no session never loads the signed-in editor (no token, no GitHub API)', async () => {
    const d = deps();
    const host = createCommentsHost(d);
    expect(host.hasSession()).toBe(false);
    expect(await host.signedInEditor()).toBeNull();
    expect(d.signedInEditor).not.toHaveBeenCalled();
  });

  it('with a session on this device, the signed-in editor is looked up (without asking to sign in)', async () => {
    const storage = new MemoryStorage() as unknown as Storage;
    sharedSessionStore(storage).save({ provider: 'github-token', token: 't', createdAt: '2026-10-09T00:00:00Z' }, true);
    const d = deps({ storage });
    const host = createCommentsHost(d);
    expect(host.hasSession()).toBe(true);
    expect(await host.signedInEditor()).not.toBeNull();
    expect(d.signedInEditor).toHaveBeenCalledTimes(1);
    expect(d.signIn).not.toHaveBeenCalled();
  });
});
