// One comment thread: the comment, its replies, and the actions a signed-in editor may take on it.
import { useState } from 'react';
import type { CommentEntry, CommentThread } from '@platform/contracts';

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function Entry({ entry, clamp = false }: { entry: CommentEntry; clamp?: boolean }) {
  return (
    <div className="pc-entry">
      <div className="pc-meta"><strong>{entry.author.login}</strong><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></div>
      <p className={`pc-body${clamp ? ' pc-clamp' : ''}`}>{entry.body}</p>
    </div>
  );
}

export interface ThreadActions {
  reply?(body: string): Promise<boolean>;
  resolve?(): void;
  reopen?(): void;
  remove?(): void;
}

export interface ThreadViewProps {
  thread: CommentThread;
  /** null: a reader (no actions are shown). */
  actions: ThreadActions | null;
  busy: boolean;
  error: string | null;
  /** Show the quoted text above the thread (panel), not on the page card. */
  showQuote?: boolean;
}

export const quoteExcerpt = (exact: string, max = 120): string => (exact.length > max ? `${exact.slice(0, max - 1)}…` : exact);

export function ThreadView({ thread, actions, busy, error, showQuote = false }: ThreadViewProps) {
  const [reply, setReply] = useState('');
  const [confirming, setConfirming] = useState(false);
  const open = thread.status === 'open';
  return (
    <div>
      {showQuote && <blockquote className="pc-quote">{quoteExcerpt(thread.anchor.exact)}</blockquote>}
      <Entry entry={thread} />
      {thread.replies.map((r) => <Entry key={r.id} entry={r} />)}
      {!open && thread.resolvedBy && (
        <div className="pc-meta" style={{ marginTop: '0.5rem' }}>Resolved by {thread.resolvedBy.login}{thread.resolvedAt ? ` on ${formatDate(thread.resolvedAt)}` : ''}</div>
      )}
      {actions && open && actions.reply && (
        <form onSubmit={(e) => { e.preventDefault(); void actions.reply!(reply.trim()).then((ok) => { if (ok) setReply(''); }); }}>
          <textarea aria-label="Reply" placeholder="Write a reply" value={reply} disabled={busy} onChange={(e) => setReply(e.target.value)} />
          <div className="pc-actions">
            <button type="submit" className="button button--sm button--primary" disabled={busy || !reply.trim()}>Reply</button>
            {actions.resolve && <button type="button" className="button button--sm button--secondary" disabled={busy} onClick={actions.resolve}>Resolve</button>}
          </div>
        </form>
      )}
      {actions && !open && (
        <div className="pc-actions">
          {actions.reopen && <button type="button" className="button button--sm button--secondary" disabled={busy} onClick={actions.reopen}>Reopen</button>}
          {actions.remove && !confirming && <button type="button" className="button button--sm button--danger" disabled={busy} onClick={() => setConfirming(true)}>Delete</button>}
        </div>
      )}
      {actions?.remove && confirming && (
        <div className="pc-confirm" role="alertdialog" aria-label="Delete this comment for good?">
          <div>Delete this comment for good?</div>
          <div className="pc-actions">
            <button type="button" className="button button--sm button--danger" disabled={busy} onClick={() => { setConfirming(false); actions.remove!(); }}>Delete for good</button>
            <button type="button" className="button button--sm button--secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {busy && <p className="pc-meta" role="status" style={{ marginTop: '0.4rem' }}>Saving...</p>}
      {error && <p className="pc-error" role="alert">{error}</p>}
    </div>
  );
}
