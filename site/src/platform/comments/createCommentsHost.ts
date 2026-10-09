// The composition root for comments: the one place that decides where a page's comments are read from (the
// published static file, no GitHub API), how an editor signs in (lazily, the editor's own sign-in) and where
// changes go (a CommentStore picked in commentSession.ts). The comments UI only sees the CommentsHost port.
import { commentsFileName, type PlatformConfig } from '@platform/contracts';
import { createPendingComments, readPublishedComments, type CommentEditor, type CommentsHost, type TabCounts } from '@platform/comments';
import type { InPlaceGlobalData } from '../inplace/editAccess';
import { DEV_SESSION_KEY, defaultStorage, sharedSessionStore } from '../inplace/sessionStores';

export interface CommentsHostDeps {
  config: PlatformConfig;
  global: InPlaceGlobalData;
  buildSha: string;
  /** The signed-in editor (commentSession.ts, loaded on first use). */
  signIn(): Promise<CommentEditor | null>;
  /** The editor of the saved session, never asking to sign in (commentSession.ts). */
  signedInEditor(): Promise<CommentEditor | null>;
  setTabCounts(counts: TabCounts): void;
  fetch?: typeof fetch;
  storage?: Storage | null;
  sessionStorage?: Storage | null;
}

/** `<baseUrl>platform/comments/<page>.json`, written into the build by the platform-comments plugin. */
export const publishedCommentsUrl = (baseUrl: string, page: string): string =>
  `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}platform/comments/${commentsFileName(page)}`;

export function createCommentsHost(deps: CommentsHostDeps): CommentsHost {
  const f = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const local = deps.global.mode === 'local-disk';
  const session = sharedSessionStore(storage, local ? DEV_SESSION_KEY : undefined);
  const tabStorage = deps.sessionStorage === undefined ? (typeof sessionStorage === 'undefined' ? null : sessionStorage) : deps.sessionStorage;
  return {
    async loadPublished(page) {
      // A new build has a new buildSha, so a deploy is never hidden behind a cached copy. The browser still asks
      // the server every time ('no-cache': a cheap 304 when unchanged): GitHub Pages sends max-age=600 and the
      // page's HTML may itself be a cached copy that names an older build. The dev server reads the disk.
      const url = `${publishedCommentsUrl(deps.config.baseUrl, page)}${local ? '' : `?v=${encodeURIComponent(deps.buildSha)}`}`;
      const res = await f(url, { cache: local ? 'no-store' : 'no-cache' });
      if (!res.ok) throw new Error(`Comments of ${page}: HTTP ${res.status}`);
      return readPublishedComments(await res.json(), page);
    },
    hasSession: () => session.load() !== null,
    signIn: deps.signIn,
    // Only with a session on this device: readers who are not signed in never load the session chunk.
    signedInEditor: async () => (session.load() ? deps.signedInEditor() : null),
    // On the dev server a save is on disk at once; the next read shows it.
    pending: local ? null : createPendingComments(() => tabStorage),
    buildSha: deps.buildSha,
    setTabCounts: deps.setTabCounts,
  };
}
