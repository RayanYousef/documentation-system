import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { emptyCommentsFile, type CommentStore, type CommentWriteOptions, type CommentWriteResult, type CommentsFile } from '@platform/contracts';
import { contentEtag } from '../writePipeline.js';
import { assertCommentsFile, commentsConflict, commentsFilePath, parseCommentsFile, serializeCommentsFile } from '../comments/commentsFile.js';
import { GitCommitter, type Committer } from './committer.js';

export interface LocalCommentStoreOptions {
  siteDir: string;
  /** How a change is recorded after the file is written. Default: a git commit (GitCommitter). */
  committer?: Committer;
}

/** Comment files in a site folder on disk (`<siteDir>/comments/...`); the dev server uses it with WorkingTreeCommitter. */
export class LocalCommentStore implements CommentStore {
  readonly id = 'local-comments';
  private readonly committer: Committer;
  /** One write at a time, so two quick saves cannot both pass the etag check. */
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly opts: LocalCommentStoreOptions) {
    this.committer = opts.committer ?? new GitCommitter();
  }

  private abs(page: string): string { return path.join(this.opts.siteDir, ...commentsFilePath(page).split('/')); }

  private async load(page: string): Promise<string | null> {
    return readFile(this.abs(page), 'utf8').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return null; throw e; });
  }

  async read(page: string): Promise<{ file: CommentsFile; etag: string | null }> {
    const text = await this.load(page);
    return text === null ? { file: emptyCommentsFile(page), etag: null } : { file: parseCommentsFile(text, page), etag: contentEtag(text) };
  }

  write(page: string, file: CommentsFile, opts: CommentWriteOptions): Promise<CommentWriteResult> {
    const run = this.queue.then(() => this.writeNow(page, file, opts));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async writeNow(page: string, file: CommentsFile, opts: CommentWriteOptions): Promise<CommentWriteResult> {
    assertCommentsFile(file, page);
    const abs = this.abs(page);
    const current = await this.load(page);
    if ((current === null ? null : contentEtag(current)) !== opts.expectedEtag) throw commentsConflict(page);
    let etag: string | null = null;
    if (file.threads.length === 0) {
      if (current === null) return { commitSha: '', commitUrl: null, etag: null };
      await rm(abs, { force: true });
    } else {
      const text = serializeCommentsFile(file);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, text);
      etag = contentEtag(text);
    }
    const commitSha = await this.committer.commit(this.opts.siteDir, opts.message, opts.author);
    return { commitSha, commitUrl: null, etag };
  }
}
