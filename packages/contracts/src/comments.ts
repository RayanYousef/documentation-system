// Comments on the text of a docs page. One JSON file per Latest page holds every thread of that page.
// Readers get the file from the built site (no GitHub API); editors change it through a CommentStore.
import type { MutationOptions } from './content.js';

/** Who wrote a comment: the GitHub login (or the dev server's display name) and a display name. */
export interface CommentAuthor { login: string; name: string }

/** The Docusaurus tab the quoted text was in, when it was inside one. */
export interface CommentTab {
  /** Position of the tab group among the page's tab groups (0 = the first <Tabs> of the page). */
  group: number;
  /** The TabItem `value`. */
  value: string;
  /** The tab's label when the comment was made (shown in the panel). */
  label: string;
}

/**
 * Where a thread points: the quoted text plus some text before and after it (like a W3C TextQuoteSelector),
 * and the tab it was in. Whitespace runs are stored as single spaces.
 */
export interface CommentAnchor {
  exact: string;
  prefix: string;
  suffix: string;
  tab: CommentTab | null;
}

export interface CommentEntry {
  id: string;
  author: CommentAuthor;
  /** ISO 8601. */
  createdAt: string;
  body: string;
}

export type CommentStatus = 'open' | 'resolved';

export interface CommentThread extends CommentEntry {
  anchor: CommentAnchor;
  status: CommentStatus;
  resolvedAt?: string;
  resolvedBy?: CommentAuthor;
  replies: CommentEntry[];
}

export const COMMENTS_SCHEMA = 1;

export interface CommentsFile {
  schema: typeof COMMENTS_SCHEMA;
  /** Bundle-relative path of the page ("systems/inventory.md"). */
  page: string;
  threads: CommentThread[];
}

export const emptyCommentsFile = (page: string): CommentsFile => ({ schema: COMMENTS_SCHEMA, page, threads: [] });

/**
 * Name of a page's comments file: "systems/inventory.md" -> "systems/inventory.json". The same name is used in the
 * repository (`<sitePath>/comments/<name>`) and on the built site (`<baseUrl>platform/comments/<name>`).
 */
export const commentsFileName = (page: string): string => `${page.replace(/\.mdx?$/, '')}.json`;

export interface CommentWriteOptions extends MutationOptions {
  /** The etag `read` returned (null: the page had no comments file). A different current file is CONFLICT. */
  expectedEtag: string | null;
}

export interface CommentWriteResult {
  /** '' when the store records no commit (the dev server's working tree). */
  commitSha: string;
  commitUrl: string | null;
  /** The new etag (null when the file was removed because no thread is left). */
  etag: string | null;
}

/**
 * Every place comment files are kept implements this and passes describeCommentStoreContract.
 * `page` is a bundle-relative Latest page path ("systems/inventory.md"); frozen versions have no comments.
 * Errors are ContentError (VALIDATION for a bad path or file, CONFLICT when the file changed since `read`).
 */
export interface CommentStore {
  readonly id: string;
  /** The page's comments; an empty file with etag null when it has none. */
  read(page: string): Promise<{ file: CommentsFile; etag: string | null }>;
  /** Replaces the page's comments file; a file with no threads removes it. */
  write(page: string, file: CommentsFile, opts: CommentWriteOptions): Promise<CommentWriteResult>;
}
