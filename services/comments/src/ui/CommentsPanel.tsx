// The Comments side panel: "Open" (comments on the page in reading order, then the unattached ones whose text
// is gone) and "Resolved" (no highlight on the page; signed-in editors can reopen or delete them).
import { useEffect, useRef, useState } from 'react';
import type { CommentThread } from '@platform/contracts';
import type { Anchoring } from '../anchor/anchor.js';
import { Entry, ThreadView, quoteExcerpt, type ThreadActions } from './ThreadView.js';

export interface CommentsPanelProps {
  threads: readonly CommentThread[];
  anchoring: Anchoring;
  signedIn: boolean;
  actionsFor(thread: CommentThread): ThreadActions | null;
  busyId: string | null;
  errorFor(id: string): string | null;
  /** Shows the comment's text on the page and opens its card. */
  onReveal(id: string): void;
  onClose(): void;
}

export function CommentsPanel({ threads, anchoring, signedIn, actionsFor, busyId, errorFor, onReveal, onClose }: CommentsPanelProps) {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const open = threads.filter((t) => t.status === 'open');
  const attached = open.filter((t) => anchoring.attached.has(t.id)).sort((a, b) => anchoring.attached.get(a.id)!.start - anchoring.attached.get(b.id)!.start);
  const unattached = open.filter((t) => !anchoring.attached.has(t.id));
  const resolved = threads.filter((t) => t.status === 'resolved');

  return (
    <aside className="pc-panel" role="complementary" aria-label="Comments" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="pc-panel-head">
        <h2 ref={heading} tabIndex={-1}>Comments</h2>
        <button type="button" className="pc-x" aria-label="Close comments" onClick={onClose}>×</button>
      </div>
      <div className="pc-tabs" role="tablist" aria-label="Comment status">
        <button type="button" role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')}>Open <span className="pc-count" aria-hidden="true">{open.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'resolved'} onClick={() => setTab('resolved')}>Resolved <span className="pc-count" aria-hidden="true">{resolved.length}</span></button>
      </div>
      <div className="pc-panel-body" role="tabpanel" aria-label={tab === 'open' ? 'Open comments' : 'Resolved comments'}>
        {tab === 'open' && (
          <>
            {!open.length && <p>No open comments. {signedIn ? 'Select text on the page to add one.' : 'Select text on the page and sign in to add one.'}</p>}
            {attached.map((t) => {
              const where = anchoring.attached.get(t.id)!.tab;
              return (
                <div key={t.id} className="pc-item" data-testid="comment-item">
                  <button type="button" className="pc-item-open" onClick={() => onReveal(t.id)} aria-label={`Show the comment on "${quoteExcerpt(t.anchor.exact, 60)}"`}>
                    <blockquote className="pc-quote">{quoteExcerpt(t.anchor.exact)}</blockquote>
                    {where && <div className="pc-tabname">In tab: {where.tab.label}</div>}
                    <Entry entry={t} clamp />
                    {t.replies.length > 0 && <div className="pc-meta">{t.replies.length === 1 ? '1 reply' : `${t.replies.length} replies`}</div>}
                  </button>
                </div>
              );
            })}
            {unattached.length > 0 && (
              <section aria-label="Unattached">
                <h3>Unattached</h3>
                <p className="pc-meta">The text these comments were on has changed or was removed.</p>
                {unattached.map((t) => (
                  <div key={t.id} className="pc-item" data-testid="unattached-item">
                    <ThreadView thread={t} actions={actionsFor(t)} busy={busyId === t.id} error={errorFor(t.id)} showQuote />
                  </div>
                ))}
              </section>
            )}
          </>
        )}
        {tab === 'resolved' && (
          <>
            {!resolved.length && <p>No resolved comments.</p>}
            {resolved.map((t) => (
              <div key={t.id} className="pc-item" data-testid="resolved-item">
                <ThreadView thread={t} actions={actionsFor(t)} busy={busyId === t.id} error={errorFor(t.id)} showQuote />
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
