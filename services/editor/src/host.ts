// The editor's ports: everything it needs from the page it is mounted in, as contract-typed objects.
// The site's composition root (site/src/platform/inplace) builds an InPlaceHost; the editor never
// imports an AuthProvider or ContentBackend implementation, the site, or the bundler.
import type { AuthProvider, ContentBackend, PlatformConfig, Session } from '@platform/contracts';

/** Where saves go: 'github' commits to the deploy branch; 'local-disk' writes the dev server's working tree. */
export type EditMode = 'github' | 'local-disk';

/** Blocks in-site navigation while there are unsaved edits. Returns the release function. */
export interface NavigationGuard {
  /**
   * Asks `message` before the site navigates to another page. `onLeave` runs when the user confirmed
   * (the edits are discarded), before the page goes away. Jumps within the same page do not ask.
   */
  block(message: string, onLeave?: () => void): () => void;
}

/** Holds the signed-in session (BrowserSessionStore implements it). */
export interface SessionStore {
  load(): Session | null;
  save(session: Session, remember: boolean): void;
  clear(): void;
}

/** The page being edited: a Latest (current) docs page, bundle-relative path. */
export interface EditablePage {
  version: 'current';
  /** Bundle-relative POSIX path, for example "systems/inventory.md". */
  path: string;
  title: string;
  /** A folder intro (`index.md`): inline title only, the generated okf block stays read-only. */
  isIndex: boolean;
}

export interface InPlaceHost {
  auth: AuthProvider;
  /** A content backend for the session (null before sign-in). */
  backend(session: Session | null): ContentBackend;
  config: PlatformConfig;
  /** URL of the components manifest (`<baseUrl>platform/components.json`). */
  componentsUrl: string;
  mode: EditMode;
  capabilities: {
    /** Publish a frozen version (live site only). */
    publish: boolean;
    /** New page / rename / delete. */
    pageOps: boolean;
  };
  sessionStore: SessionStore;
  navigation: NavigationGuard;
  urls: {
    /** Site URL of a bundle page ("systems/index.md" -> "/base/systems/"), or null when unknown. */
    pageUrl(pagePath: string): string | null;
    /** Web URL of a commit, or null (dev mode). */
    commitUrl(sha: string): string | null;
  };
  /** Commit the served site was built from ('local' outside CI). Pending edits expire when it changes. */
  buildSha: string;
  /** In-site navigation (client-side router). */
  navigate(url: string): void;
  /** Called after a successful sign-in, so the site's own content backend picks up the token. */
  onSignedIn?(): void;
}
