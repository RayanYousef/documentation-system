import { ContentError, type Author } from '@platform/contracts';
import { commitAll, createTag } from './git.js';

/**
 * How LocalFolderBackend records a change after writing files. A new way to record changes is a new
 * Committer passed to the backend; the backend itself does not change.
 */
export interface Committer {
  /** false when changes stay in the working tree (no commit sha to tag, so publishing is refused). */
  readonly createsCommits: boolean;
  /** Records the working-tree changes under `siteDir`; resolves the commit sha, or '' when nothing is committed. */
  commit(siteDir: string, message: string, author: Author): Promise<string>;
  tag(siteDir: string, name: string, sha: string): Promise<void>;
}

/** `git add -A` + `git commit` in the site's repository (tests, e2e, the CLI). */
export class GitCommitter implements Committer {
  readonly createsCommits = true;
  commit(siteDir: string, message: string, author: Author): Promise<string> { return commitAll(siteDir, message, author); }
  async tag(siteDir: string, name: string, sha: string): Promise<void> { await createTag(siteDir, name, sha); }
}

/**
 * Leaves the written files in the working tree for the developer to review and commit with their own
 * git flow (the dev server's disk endpoint). Never touches the index or HEAD.
 */
export class WorkingTreeCommitter implements Committer {
  readonly createsCommits = false;
  async commit(): Promise<string> { return ''; }
  async tag(): Promise<void> { throw new ContentError('FORBIDDEN', 'Publishing needs a git commit; run it from the CLI'); }
}
