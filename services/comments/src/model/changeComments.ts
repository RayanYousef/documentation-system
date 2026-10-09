import { ContentError, type Author, type CommentStore, type CommentWriteResult, type CommentsFile } from '@platform/contracts';
import { applyOp, commitMessage, type CommentOp } from './ops.js';

/** Attempts in all when the comments file keeps changing between read and write. */
const ATTEMPTS = 3;

/**
 * Applies one action to the page's latest comments and stores the result. When the file changed between the
 * read and the write (CONFLICT), the action is applied again to the newer file, so nobody's comment is lost.
 */
export async function changeComments(store: CommentStore, page: string, op: CommentOp, author: Author): Promise<CommentWriteResult & { file: CommentsFile }> {
  for (let attempt = 1; ; attempt++) {
    const { file, etag } = await store.read(page);
    const next = applyOp(file, op);
    try {
      return { ...(await store.write(page, next, { message: commitMessage(op, page), author, expectedEtag: etag })), file: next };
    } catch (e) {
      if (!(e instanceof ContentError && e.code === 'CONFLICT')) throw e;
      if (attempt >= ATTEMPTS) throw new ContentError('CONFLICT', 'Someone else changed the comments on this page at the same time. Try again.', e.details);
    }
  }
}
