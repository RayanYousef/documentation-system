// The comments UI's ports: everything it needs from the site, as contract-typed objects. The site's
// composition root (site/src/platform/comments) builds a CommentsHost; this package never imports an
// AuthProvider, a CommentStore implementation, the editor or the site.
import type { CommentStore, CommentsFile, Identity } from '@platform/contracts';
import type { PendingComments } from './pending.js';

/** A signed-in editor who may change comments, with the store their changes go to. */
export interface CommentEditor {
  identity: Identity;
  store: CommentStore;
}

/** Open (unresolved, attached) comment counts of one tab group, by tab value. */
export type TabCounts = Map<Element, Record<string, number>>;

export interface CommentsHost {
  /** The page's published comments (a static file of the built site; no GitHub API, no rate limit). */
  loadPublished(page: string): Promise<CommentsFile>;
  /** Whether someone is signed in on this device (no network): editors see Reply, Resolve, Reopen, Delete. */
  hasSession(): boolean;
  /**
   * The signed-in editor (a remembered session is checked once per tab), asking to sign in with the site's
   * sign-in dialog when needed. Null when the person cancelled.
   */
  signIn(): Promise<CommentEditor | null>;
  /**
   * The editor signed in on this device, never asking (no dialog): null when nobody is signed in or the saved
   * session cannot be used. The page reads the current comments from its store, so an editor never sees the
   * published file while a deploy is still pending. Readers who are not signed in never call it.
   */
  signedInEditor(): Promise<CommentEditor | null>;
  /** Keeps the author's changes until the deploy shows them; null where saves show at once (dev server). */
  pending: PendingComments | null;
  /** Commit the served site was built from (a pending change ends when the site is built from its commit). */
  buildSha: string;
  /** Shows the open-comment count on each tab label (the site's Tabs read it). */
  setTabCounts(counts: TabCounts): void;
}
