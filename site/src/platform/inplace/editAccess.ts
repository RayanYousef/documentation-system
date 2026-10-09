// Who may change content and how they sign in, decided once per page for everything that writes: the
// in-place editor (createInPlaceHost) and the comments (site/src/platform/comments). Kept apart from
// createInPlaceHost so the comments can sign someone in without loading the docs content backends.
//   github     (live site, or PLATFORM_EDIT_BACKEND=github): GitHub token sign-in
//   local-disk (`npm start`, when the dev endpoint answers): display-name sign-in, the dev endpoint's token
import type { AuthProvider, PlatformConfig } from '@platform/contracts';
import { GithubTokenProvider, MockAuthProvider } from '@platform/auth';
import type { EditMode, SessionStore } from '@platform/editor/inplace';
import { DEV_SESSION_KEY, defaultStorage, sharedSessionStore } from './sessionStores';

export { DEV_SESSION_KEY, defaultStorage };

/** Global data of the platform-inplace-edit plugin (site/plugins/platform-inplace-edit). */
export interface InPlaceGlobalData {
  enabled: boolean;
  mode: 'github' | 'local-disk';
  /** local-disk: `<baseUrl>__platform/content` on the dev server. */
  endpoint?: string;
  /** local-disk: the dev server's per-process secret. */
  devToken?: string;
}

export const DEV_TOKEN_HEADER = 'X-Platform-Dev-Token';

/** fetch that adds the dev token (only ever used for the same-origin dev endpoint). */
export function withDevToken(f: typeof fetch, token: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(DEV_TOKEN_HEADER, token);
    return f(input, { ...init, headers, credentials: 'same-origin' });
  };
}

/** True when the dev server's disk endpoint answers (it does not exist in production builds). */
export async function devEndpointAvailable(global: InPlaceGlobalData, f: typeof fetch): Promise<boolean> {
  if (global.mode !== 'local-disk' || !global.endpoint || !global.devToken) return false;
  try {
    const res = await withDevToken(f, global.devToken)(`${global.endpoint}/ping`, { method: 'GET' });
    if (!res.ok) return false;
    return ((await res.json()) as { ok?: boolean }).ok === true;
  } catch { return false; }
}

export interface AccessDeps {
  config: PlatformConfig;
  global: InPlaceGlobalData;
  fetch?: typeof fetch;
  storage?: Storage | null;
}

export interface EditAccess {
  mode: EditMode;
  auth: AuthProvider;
  /** The tab's session store for this mode (one instance per storage and key, so a sign-in is seen everywhere). */
  sessionStore: SessionStore;
  /** local-disk: the dev endpoint and a fetch that carries its token. */
  dev: { endpoint: string; fetch: typeof fetch } | null;
}

export async function resolveEditAccess(deps: AccessDeps): Promise<EditAccess> {
  const { config, global } = deps;
  const f = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const local = await devEndpointAvailable(global, f);
  return local
    ? { mode: 'local-disk', auth: new MockAuthProvider(), sessionStore: sharedSessionStore(storage, DEV_SESSION_KEY), dev: { endpoint: global.endpoint!, fetch: withDevToken(f, global.devToken!) } }
    : { mode: 'github', auth: new GithubTokenProvider({ owner: config.organizationName, repo: config.projectName, fetch: deps.fetch }), sessionStore: sharedSessionStore(storage), dev: null };
}
