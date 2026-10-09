import { describe, it, expect, vi } from 'vitest';
import type { PlatformConfig } from '@platform/contracts';
import { sharedSessionStore } from '../inplace/sessionStores';
import { currentCommentEditor } from './commentSession';

const config = { baseUrl: '/documentation-system/', organizationName: 'RayanYousef', projectName: 'documentation-system', deployBranch: 'main', sitePath: 'site' } as unknown as PlatformConfig;

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** GitHub for one token: `good` may push; anything else is 401. */
const github = (good: string) => vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const auth = new Headers(init?.headers).get('authorization') ?? '';
  if (!auth.endsWith(good)) return json(401, { message: 'Bad credentials' });
  const url = String(input);
  if (url.endsWith('/user')) return json(200, { login: 'mira', name: 'Mira Okonkwo', email: 'mira@example.com' });
  return json(200, { permissions: { push: true } });
});

function withSession(token: string): Storage {
  const storage = new MemoryStorage() as unknown as Storage;
  sharedSessionStore(storage).save({ provider: 'github-token', token, createdAt: '2026-10-09T00:00:00Z' }, true);
  return storage;
}

describe('currentCommentEditor (the page loads the current comments for a signed-in editor)', () => {
  it('no session on this device: null, and nothing is asked or fetched', async () => {
    const f = github('x');
    const dialog = vi.fn();
    expect(await currentCommentEditor({ config, global: { enabled: true, mode: 'github' }, fetch: f as unknown as typeof fetch, storage: new MemoryStorage() as unknown as Storage, signInDialog: dialog })).toBeNull();
    expect(dialog).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });

  it('a working saved session: the editor with a GitHub comment store, never the sign-in dialog', async () => {
    const dialog = vi.fn();
    const ed = await currentCommentEditor({ config, global: { enabled: true, mode: 'github' }, fetch: github('session-ok') as unknown as typeof fetch, storage: withSession('session-ok'), signInDialog: dialog });
    expect(ed?.identity.login).toBe('mira');
    expect(ed?.store.id).toBe('github-comments');
    expect(dialog).not.toHaveBeenCalled();
  });

  it('a saved session GitHub rejects: null, no dialog, and the session is left for the next action to handle', async () => {
    const dialog = vi.fn();
    const storage = withSession('revoked');
    expect(await currentCommentEditor({ config, global: { enabled: true, mode: 'github' }, fetch: github('other') as unknown as typeof fetch, storage, signInDialog: dialog })).toBeNull();
    expect(dialog).not.toHaveBeenCalled();
    expect(sharedSessionStore(storage).load()).not.toBeNull();
  });
});
