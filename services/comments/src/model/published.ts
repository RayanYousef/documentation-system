import { COMMENTS_SCHEMA, emptyCommentsFile, type CommentThread, type CommentsFile } from '@platform/contracts';

const okThread = (t: unknown): t is CommentThread => {
  const x = t as CommentThread;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.body === 'string' && (x.status === 'open' || x.status === 'resolved')
    && !!x.author && typeof x.author.login === 'string' && !!x.anchor && typeof x.anchor.exact === 'string' && Array.isArray(x.replies);
};

/**
 * A published comments file as readers get it from the site. Files are checked when they are written, so this
 * only guards the page against a hand-edited file: malformed threads are skipped, anything else is empty.
 */
export function readPublishedComments(data: unknown, page: string): CommentsFile {
  const f = data as CommentsFile | null;
  if (!f || typeof f !== 'object' || f.schema !== COMMENTS_SCHEMA || !Array.isArray(f.threads)) return emptyCommentsFile(page);
  return { schema: COMMENTS_SCHEMA, page, threads: f.threads.filter(okThread).map((t) => ({ ...t, replies: t.replies.filter((r) => !!r && typeof r.body === 'string' && !!r.author) })) };
}
