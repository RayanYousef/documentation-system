// The five things an editor can do to a page's comments, as pure functions on a comments file. A change is
// always applied to the latest file read from the store, so two editors commenting at once both keep theirs.
import { ContentError, type CommentAnchor, type CommentAuthor, type CommentThread, type CommentsFile } from '@platform/contracts';

export type CommentOp =
  | { kind: 'add'; id: string; anchor: CommentAnchor; body: string; author: CommentAuthor; at: string }
  | { kind: 'reply'; threadId: string; id: string; body: string; author: CommentAuthor; at: string }
  | { kind: 'resolve'; threadId: string; author: CommentAuthor; at: string }
  | { kind: 'reopen'; threadId: string }
  | { kind: 'delete'; threadId: string };

const gone = () => new ContentError('NOT_FOUND', 'This comment no longer exists; someone may have deleted it. Reload the page to see the latest comments.');

function mapThread(file: CommentsFile, id: string, change: (t: CommentThread) => CommentThread): CommentsFile {
  if (!file.threads.some((t) => t.id === id)) throw gone();
  return { ...file, threads: file.threads.map((t) => (t.id === id ? change(t) : t)) };
}

/** The file after `op`; the given file is not changed. Throws NOT_FOUND when the thread is gone. */
export function applyOp(file: CommentsFile, op: CommentOp): CommentsFile {
  switch (op.kind) {
    case 'add':
      return { ...file, threads: [...file.threads, { id: op.id, author: op.author, createdAt: op.at, body: op.body, anchor: op.anchor, status: 'open', replies: [] }] };
    case 'reply':
      return mapThread(file, op.threadId, (t) => ({ ...t, replies: [...t.replies, { id: op.id, author: op.author, createdAt: op.at, body: op.body }] }));
    case 'resolve':
      return mapThread(file, op.threadId, (t) => ({ ...t, status: 'resolved', resolvedAt: op.at, resolvedBy: op.author }));
    case 'reopen':
      return mapThread(file, op.threadId, ({ resolvedAt: _at, resolvedBy: _by, ...t }) => ({ ...t, status: 'open' }));
    case 'delete':
      if (!file.threads.some((t) => t.id === op.threadId)) throw gone();
      return { ...file, threads: file.threads.filter((t) => t.id !== op.threadId) };
  }
}

const VERBS: Record<CommentOp['kind'], string> = {
  add: 'Comment on', reply: 'Reply to a comment on', resolve: 'Resolve a comment on', reopen: 'Reopen a comment on', delete: 'Delete a comment on',
};

/** The commit message of an action ("Comment on systems/inventory.md"). */
export const commitMessage = (op: CommentOp, page: string): string => `${VERBS[op.kind]} ${page}`;

/** A new comment or reply id: time plus randomness, unique enough for one page. */
export function newCommentId(now: number = Date.now()): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `c${now.toString(36)}${[...bytes].map((b) => b.toString(36).padStart(2, '0')).join('')}`;
}
