// The composition root for in-place editing: the one place that picks the AuthProvider and the
// ContentBackend implementations and hands the editor a contract-typed InPlaceHost.
//   github     (live site, or PLATFORM_EDIT_BACKEND=github): GitHub token sign-in, commits to the deploy branch
//   local-disk (`npm start`): display-name sign-in, saves to the dev server's same-origin disk endpoint
// The mode, sign-in and session store come from resolveEditAccess (editAccess.ts), which the comments share.
// A new provider or backend is wired here (and its sign-in panel registered in the editor); nothing else changes.
// No Docusaurus imports: the Docusaurus-specific pieces (router, config, global data) come in as arguments.
import type { ContentBackend, PlatformConfig, Session } from '@platform/contracts';
import { GithubBrowserBackend, HttpContentBackend } from '@platform/content';
import type { InPlaceHost, NavigationGuard } from '@platform/editor/inplace';
import { pageUrl } from './pagePath';
import { resolveEditAccess, type InPlaceGlobalData } from './editAccess';

export { DEV_SESSION_KEY, DEV_TOKEN_HEADER, devEndpointAvailable, withDevToken, type InPlaceGlobalData } from './editAccess';

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

export async function createInPlaceHost(deps: HostDeps): Promise<InPlaceHost> {
  const { config } = deps;
  const access = await resolveEditAccess(deps);
  let backend: (session: Session | null) => ContentBackend;
  if (access.dev) {
    const http = new HttpContentBackend(access.dev.endpoint, access.dev.fetch);
    backend = () => http;
  } else {
    backend = (session) => new GithubBrowserBackend({
      owner: config.organizationName, repo: config.projectName, branch: config.deployBranch, sitePath: config.sitePath,
      codeRepos: config.codeRepos, token: session?.token ?? null, fetch: deps.fetch,
    });
  }
  const { mode } = access;
  return {
    auth: access.auth,
    backend,
    config,
    componentsUrl: `${config.baseUrl}platform/components.json`,
    mode,
    capabilities: { publish: mode === 'github', pageOps: true },
    sessionStore: access.sessionStore,
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
