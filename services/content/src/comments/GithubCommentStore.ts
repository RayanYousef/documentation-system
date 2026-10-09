import { ContentError, emptyCommentsFile, type CommentStore, type CommentWriteOptions, type CommentWriteResult, type CommentsFile } from '@platform/contracts';
import { GitDataClient, type Head } from '../github/gitData.js';
import { assertCommentsFile, commentsConflict, commentsFilePath, parseCommentsFile, serializeCommentsFile } from './commentsFile.js';

export interface GithubCommentStoreOptions { owner: string; repo: string; branch: string; sitePath: string; token: string | null; fetch?: typeof fetch; apiRoot?: string }

/** Retries after a branch-moved rejection (another commit landed between reading main and committing). */
const BRANCH_MOVED_RETRIES = 2;
const isBranchMoved = (e: unknown): boolean => e instanceof ContentError && e.code === 'CONFLICT' && (e.details as { reason?: string } | undefined)?.reason === 'branch-moved';

/**
 * Comment files on GitHub, read and written with the Git Data API and the editor's token. Every write is one
 * commit on `branch` that names its expected parent; when the branch moved for another reason the write is
 * computed again on the new head (the comments file itself must still be the one that was read).
 */
export class GithubCommentStore implements CommentStore {
  readonly id = 'github-comments';
  private readonly git: GitDataClient;
  constructor(private readonly opts: GithubCommentStoreOptions) {
    this.git = new GitDataClient({ owner: opts.owner, repo: opts.repo, token: opts.token, fetch: opts.fetch, apiRoot: opts.apiRoot });
  }

  private repoPath(page: string): string { return `${this.opts.sitePath ? `${this.opts.sitePath}/` : ''}${commentsFilePath(page)}`; }

  private async current(page: string): Promise<{ head: Head; sha: string | null }> {
    const path = this.repoPath(page);
    const head = await this.git.getHead(this.opts.branch);
    const entry = (await this.git.getTree(head.treeSha)).find((e) => e.type === 'blob' && e.path === path);
    return { head, sha: entry?.sha ?? null };
  }

  async read(page: string): Promise<{ file: CommentsFile; etag: string | null }> {
    const { sha } = await this.current(page);
    return sha ? { file: parseCommentsFile(await this.git.getBlobText(sha), page), etag: sha } : { file: emptyCommentsFile(page), etag: null };
  }

  async write(page: string, file: CommentsFile, opts: CommentWriteOptions): Promise<CommentWriteResult> {
    assertCommentsFile(file, page);
    const path = this.repoPath(page);
    const removes = file.threads.length === 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const { head, sha } = await this.current(page);
        if (sha !== opts.expectedEtag) throw commentsConflict(page);
        if (removes && !sha) return { commitSha: '', commitUrl: null, etag: null }; // nothing stored, nothing to remove
        const commitSha = await this.git.commitFiles(this.opts.branch, removes ? {} : { [path]: serializeCommentsFile(file) }, removes && sha ? [path] : [], opts.message, opts.author, { expectedParent: head });
        const etag = removes ? null : (await this.current(page)).sha;
        return { commitSha, commitUrl: `https://github.com/${this.opts.owner}/${this.opts.repo}/commit/${commitSha}`, etag };
      } catch (e) {
        if (!isBranchMoved(e) || attempt >= BRANCH_MOVED_RETRIES) throw e;
      }
    }
  }
}
