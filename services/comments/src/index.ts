// Comments on the text of docs pages (@platform/comments): the reader and editor UI, text-quote anchoring and
// the pure comment actions. It sees only contract types; the site's composition root (site/src/platform/comments)
// supplies the CommentsHost (published files, sign-in, the CommentStore).
export { CommentsLayer, type CommentsLayerProps } from './ui/CommentsLayer.js';
export type { CommentEditor, CommentsHost, TabCounts } from './host.js';
export { createPendingComments, PENDING_COMMENTS_KEY, PENDING_COMMENTS_TTL_MS, type PendingComments } from './pending.js';
export { readPublishedComments } from './model/published.js';
export { applyOp, commitMessage, newCommentId, type CommentOp } from './model/ops.js';
export { changeComments } from './model/changeComments.js';
export { anchorForRange, anchorThreads, MAX_QUOTE, type Anchoring, type Attached } from './anchor/anchor.js';
export { findQuote, quoteAt, normalizeSpace, CONTEXT_CHARS, type Quote } from './anchor/textQuote.js';
