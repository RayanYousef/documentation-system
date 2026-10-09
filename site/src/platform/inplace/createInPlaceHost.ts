// The composition root for in-place editing: the one place that picks the AuthProvider and the
// ContentBackend implementations and hands the editor a contract-typed InPlaceHost.
//   github     (live site, or PLATFORM_EDIT_BACKEND=github): GitHub token sign-in, commits to the deploy branch
//   local-disk (`npm start`): display-name sign-in, saves to the dev server's same-origin disk endpoint
// A new provider or backend is wired here (and its sign-in panel registered in the editor); nothing else changes.
// No Docusaurus imports: the Docusaurus-specific pieces (router, config, global data) come in as arguments.
import type { AuthProvider, ContentBackend, PlatformConfig, Session } from '@platform/contracts';
import { GithubTokenProvider, MockAuthProvider } from '@platform/auth';
import { GithubBrowserBackend, HttpContentBackend } from '@platform/content';
import type { InPlaceHost, NavigationGuard } from '@platform/editor/inplace';
import { BrowserSessionStore } from '@platform/editor/session';
import { pageUrl } from './pagePath';

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
/** Dev sign-ins (display names) are kept apart from the GitHub token the site uses for private assets. */
export const DEV_SESSION_KEY = 'docs-platform.dev-session';

export interface HostDeps {
  config: PlatformConfig;
  global: InPlaceGlobalData;
  buildSha: string;
  navigation: NavigationGuard;
  navigate(url: string): void;
  /** Called after sign-in so the site's own content backend (viewers, private assets) uses the new token. */
  onSignedIn?(): void;
  fetch?: typeof fetch;
  storage?: Storage | null;
}

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

export async function createInPlaceHost(deps: HostDeps): Promise<InPlaceHost> {
  const { config, global } = deps;
  const f = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const storage = deps.storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : deps.storage;
  const local = await devEndpointAvailable(global, f);

  let auth: AuthProvider;
  let backend: (session: Session | null) => ContentBackend;
  if (local) {
    const http = new HttpContentBackend(global.endpoint!, withDevToken(f, global.devToken!));
    auth = new MockAuthProvider();
    backend = () => http;
  } else {
    auth = new GithubTokenProvider({ owner: config.organizationName, repo: config.projectName, fetch: deps.fetch });
    backend = (session) => new GithubBrowserBackend({
      owner: config.organizationName, repo: config.projectName, branch: config.deployBranch, sitePath: config.sitePath,
      codeRepos: config.codeRepos, token: session?.token ?? null, fetch: deps.fetch,
    });
  }
  const mode = local ? 'local-disk' : 'github';
  return {
    auth,
    backend,
    config,
    componentsUrl: `${config.baseUrl}platform/components.json`,
    mode,
    capabilities: { publish: mode === 'github', pageOps: true },
    sessionStore: new BrowserSessionStore(storage, local ? DEV_SESSION_KEY : undefined),
    navigation: deps.navigation,
    urls: {
      pageUrl: (p) => pageUrl(config.baseUrl, p),
      commitUrl: (sha) => (mode === 'github' && sha ? `https://github.com/${config.organizationName}/${config.projectName}/commit/${sha}` : null),
    },
    buildSha: deps.buildSha,
    navigate: deps.navigate,
    onSignedIn: mode === 'github' ? deps.onSignedIn : undefined,
  };
}
