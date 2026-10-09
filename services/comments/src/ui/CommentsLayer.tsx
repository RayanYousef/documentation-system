// Comments on a docs page, for every reader: commented text is highlighted (no change to the page's DOM),
// hovering shows the comment, clicking opens the thread, and the Comments panel lists open, unattached and
// resolved comments. Signed-in editors also add (select text, then "Comment"), reply, resolve, reopen and
// delete. The site mounts this next to its Edit button on Latest pages and unmounts it while editing.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { emptyCommentsFile, type CommentAnchor, type CommentAuthor, type CommentThread, type CommentsFile, type Identity } from '@platform/contracts';
import { anchorForRange, anchorThreads, type Anchoring } from '../anchor/anchor.js';
import { tabElementFor } from '../anchor/tabs.js';
import type { CommentEditor, CommentsHost, TabCounts } from '../host.js';
import { changeComments } from '../model/changeComments.js';
import { newCommentId, type CommentOp } from '../model/ops.js';
import { FallbackMarks, paintHighlights, rangeContains, supportsHighlights } from './highlights.js';
import { CommentsPanel } from './CommentsPanel.js';
import { useCommentStyles } from './styles.js';
import { Entry, ThreadView } from './ThreadView.js';

export interface CommentsLayerProps {
  host: CommentsHost;
  /** Bundle-relative path of the page ("systems/inventory.md"). */
  page: string;
}

interface Spot { top: number; left: number }
interface Draft { anchor: CommentAnchor; at: Spot }
type Where = 'draft' | 'card' | `panel:${string}`;

const NO_ANCHORING: Anchoring = { attached: new Map(), unattached: [] };
const MESSAGE_PREFIX = 'Could not save the comment: ';

/** Below a client rect, in document coordinates, kept inside the viewport horizontally. */
function below(r: DOMRect | { left: number; bottom: number }, width = 340): Spot {
  const left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - width - 8));
  return { top: r.bottom + window.scrollY + 6, left: left + window.scrollX };
}

const commitAuthor = (id: Identity) => ({ name: id.name || id.login, email: id.email ?? `${id.login}@users.noreply.github.com` });
const authorOf = (id: Identity): CommentAuthor => ({ login: id.login, name: id.name || id.login });

export function CommentsLayer({ host, page }: CommentsLayerProps) {
  useCommentStyles();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<CommentsFile | null>(null);
  const [anchoring, setAnchoring] = useState<Anchoring>(NO_ANCHORING);
  const [layoutVersion, bumpLayout] = useReducer((x: number) => x + 1, 0);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [hover, setHover] = useState<{ id: string; at: Spot } | null>(null);
  const [card, setCard] = useState<{ id: string; at: Spot } | null>(null);
  const [selection, setSelection] = useState<Draft | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftText, setDraftText] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState<Where | null>(null);
  const [error, setError] = useState<{ where: Where; message: string } | null>(null);
  const editor = useRef<CommentEditor | null>(null);
  const signedIn = host.hasSession();

  const root = useCallback((): Element | null => buttonRef.current?.closest('article')?.querySelector('.theme-doc-markdown') ?? null, []);

  // ----- load: the tab's pending copy (the author's own recent change), else the published file -----
  useEffect(() => {
    let alive = true;
    const pending = host.pending?.get(page, host.buildSha);
    if (pending) { setFile(pending); return undefined; }
    host.loadPublished(page).then((f) => { if (alive) setFile(f); }, () => { if (alive) setFile(emptyCommentsFile(page)); });
    return () => { alive = false; };
  }, [host, page]);

  const open = useMemo(() => (file?.threads ?? []).filter((t) => t.status === 'open'), [file]);
  const byId = useMemo(() => new Map((file?.threads ?? []).map((t) => [t.id, t])), [file]);

  // ----- anchoring: again whenever the page's content changes (saved preview, tab switch, hot reload) -----
  const reanchor = useCallback(() => {
    const el = root();
    setAnchoring(el && open.length ? anchorThreads(el, open) : NO_ANCHORING);
    bumpLayout();
  }, [root, open]);

  useEffect(() => {
    reanchor();
    const article = buttonRef.current?.closest('article');
    if (!article) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver((records) => {
      if (records.every((r) => (r.target as Element).closest?.('[data-comments-ignore]') || r.target.parentElement?.closest('[data-comments-ignore]'))) return;
      clearTimeout(timer);
      timer = setTimeout(reanchor, 120);
    });
    observer.observe(article, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [reanchor]);

  // ----- painting -----
  const active = card?.id ?? hover?.id ?? null;
  const ranges = useMemo(() => [...anchoring.attached.values()].map((a) => a.range), [anchoring]);
  const activeRange = active ? anchoring.attached.get(active)?.range ?? null : null;
  const native = supportsHighlights();
  useEffect(() => (native ? paintHighlights(ranges, activeRange) : undefined), [native, ranges, activeRange]);

  // ----- open-comment counts on tab labels -----
  useEffect(() => {
    const counts: TabCounts = new Map();
    for (const a of anchoring.attached.values()) {
      if (!a.tab) continue;
      const forGroup = counts.get(a.tab.group) ?? {};
      forGroup[a.tab.tab.value] = (forGroup[a.tab.tab.value] ?? 0) + 1;
      counts.set(a.tab.group, forGroup);
    }
    host.setTabCounts(counts);
  }, [host, anchoring]);
  useEffect(() => () => host.setTabCounts(new Map()), [host]);

  // ----- hover and click on highlighted text (hit-testing the ranges' rects) -----
  const hitAt = useCallback((x: number, y: number): string | null => {
    for (const [id, a] of anchoring.attached) if (rangeContains(a.range, x, y)) return id;
    return null;
  }, [anchoring]);

  useEffect(() => {
    let frame = 0;
    let last: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!last) return;
        const id = hitAt(last.x, last.y);
        setHover((h) => {
          if (!id) return null;
          if (h?.id === id) return h;
          const rect = Array.from(anchoring.attached.get(id)!.range.getClientRects()).find((r) => last!.x >= r.left && last!.x <= r.right && last!.y >= r.top && last!.y <= r.bottom);
          return { id, at: below(rect ?? anchoring.attached.get(id)!.range.getBoundingClientRect(), 300) };
        });
      });
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-comments-ui]')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return; // the end of a text selection, not a click on a comment
      const id = hitAt(e.clientX, e.clientY);
      if (id) { setHover(null); setCard({ id, at: below(anchoring.attached.get(id)!.range.getBoundingClientRect()) }); setError(null); }
      else setCard(null);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('click', onClick); cancelAnimationFrame(frame); };
  }, [hitAt, anchoring]);

  // ----- selecting text offers "Comment" -----
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        const el = root();
        if (!sel || sel.isCollapsed || !sel.rangeCount || !el) { setSelection(null); setSelectionError(null); return; }
        const range = sel.getRangeAt(0);
        if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) { setSelection(null); return; }
        const anchor = anchorForRange(el, range);
        if (!anchor) { setSelection(null); return; }
        const rects = range.getClientRects();
        const lastRect = rects[rects.length - 1] ?? range.getBoundingClientRect();
        const at = below({ left: lastRect.right - 40, bottom: lastRect.bottom }, 160);
        if (anchor === 'too-long') { setSelection(null); setSelectionError('Select less text to comment on it (at most 1000 characters).'); return; }
        setSelectionError(null);
        setSelection({ anchor, at });
      }, 150);
    };
    document.addEventListener('selectionchange', onChange);
    return () => { document.removeEventListener('selectionchange', onChange); clearTimeout(timer); };
  }, [root]);

  // The opened card takes the focus, so its Reply and Resolve come next for the keyboard (the card is drawn
  // apart from the panel and the text); closing it gives the focus back to what opened it (a panel entry).
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = card?.id ?? null;
  useEffect(() => {
    if (!cardId) return undefined;
    const focused = document.activeElement;
    const opener = focused instanceof HTMLElement && focused !== document.body && !cardRef.current?.contains(focused) ? focused : null;
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      const now = document.activeElement;
      // Only when the focus went down with the card (Escape, the close button, Resolve), not when it moved on.
      if (opener?.isConnected && (!now || now === document.body)) opener.focus({ preventScroll: true });
    };
  }, [cardId]);

  // Escape closes the card and the new-comment box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCard(null); setDraft(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ----- actions -----
  const getEditor = useCallback(async (): Promise<CommentEditor | null> => {
    if (editor.current && host.hasSession()) return editor.current;
    const e = await host.signIn();
    editor.current = e;
    rerender();
    return e;
  }, [host]);

  const run = useCallback(async (where: Where, make: (author: CommentAuthor) => CommentOp): Promise<boolean> => {
    setBusy(where);
    setError(null);
    try {
      const ed = await getEditor();
      if (!ed) return false;
      const res = await changeComments(ed.store, page, make(authorOf(ed.identity)), commitAuthor(ed.identity));
      setFile(res.file);
      host.pending?.save(page, res.file, host.buildSha);
      return true;
    } catch (e) {
      setError({ where, message: `${MESSAGE_PREFIX}${(e as Error).message}` });
      return false;
    } finally {
      setBusy(null);
    }
  }, [getEditor, host, page]);

  const now = () => new Date().toISOString();
  const threadActions = (t: CommentThread, where: Where) => (signedIn ? {
    reply: (body: string) => run(where, (author) => ({ kind: 'reply', threadId: t.id, id: newCommentId(), body, author, at: now() })),
    resolve: () => { void run(where, (author) => ({ kind: 'resolve', threadId: t.id, author, at: now() })).then((ok) => { if (ok && where === 'card') setCard(null); }); },
    reopen: () => { void run(where, () => ({ kind: 'reopen', threadId: t.id })); },
    remove: () => { void run(where, () => ({ kind: 'delete', threadId: t.id })); },
  } : null);

  const startComment = async () => {
    if (!selection) return;
    const sel = selection;
    if (!signedIn) {
      const ed = await getEditor();
      if (!ed) return;
    }
    setDraft(sel);
    setDraftText('');
    setSelection(null);
    setError(null);
  };

  const saveDraft = async () => {
    if (!draft || !draftText.trim()) return;
    const ok = await run('draft', (author) => ({ kind: 'add', id: newCommentId(), anchor: draft.anchor, body: draftText.trim(), author, at: now() }));
    if (ok) { setDraft(null); setDraftText(''); window.getSelection()?.removeAllRanges(); }
  };

  /** Shows a comment's text: its tab first, then scrolls to it and opens its card. */
  const reveal = (id: string) => {
    const a = anchoring.attached.get(id);
    if (!a) return;
    const panel = (a.range.startContainer.parentElement)?.closest('[role="tabpanel"]');
    if (panel && (panel as HTMLElement).hidden) tabElementFor(panel)?.click();
    requestAnimationFrame(() => {
      a.range.startContainer.parentElement?.scrollIntoView({ block: 'center' });
      requestAnimationFrame(() => setCard({ id, at: below(a.range.getBoundingClientRect()) }));
    });
  };

  // ----- render -----
  const openCount = open.length;
  const cardThread = card ? byId.get(card.id) : undefined;
  const hoverThread = hover && hover.id !== card?.id ? byId.get(hover.id) : undefined;

  return (
    <>
      <button ref={buttonRef} type="button" className="button button--sm button--secondary" data-comments-ignore="" data-testid="comments-button"
        aria-expanded={panelOpen} aria-label={openCount ? `Comments (${openCount} open)` : 'Comments'} onClick={() => setPanelOpen(!panelOpen)}>
        Comments{openCount ? <span className="pc-count" aria-hidden="true">{openCount}</span> : null}
      </button>
      {createPortal(
        <div data-comments-ui="" data-comments-ignore="">
          {!native && <FallbackMarks ranges={ranges} active={activeRange} version={layoutVersion} />}
          {hoverThread && hover && (
            <div className="pc-pop pc-pop--hover" role="tooltip" style={{ top: hover.at.top, left: hover.at.left }} data-testid="comment-hover">
              <Entry entry={hoverThread} clamp />
              {hoverThread.replies.length > 0 && <div className="pc-meta">{hoverThread.replies.length === 1 ? '1 reply' : `${hoverThread.replies.length} replies`}</div>}
            </div>
          )}
          {cardThread && card && (
            <div ref={cardRef} tabIndex={-1} className="pc-pop" role="dialog" aria-label="Comment thread" style={{ top: card.at.top, left: card.at.left }}>
              <div style={{ display: 'flex' }}><button type="button" className="pc-x" aria-label="Close comment" onClick={() => setCard(null)}>×</button></div>
              <ThreadView thread={cardThread} actions={threadActions(cardThread, 'card')} busy={busy === 'card'} error={error?.where === 'card' ? error.message : null} />
            </div>
          )}
          {selection && !draft && (
            <button type="button" className="pc-selbtn button button--sm button--primary" style={{ top: selection.at.top, left: selection.at.left }}
              onMouseDown={(e) => e.preventDefault()} onClick={() => void startComment()}>
              {signedIn ? 'Comment' : 'Sign in to comment'}
            </button>
          )}
          {selectionError && !draft && <div className="pc-pop pc-pop--hover" role="status" style={{ position: 'fixed', top: 'calc(var(--ifm-navbar-height) + 8px)', right: 8, left: 'auto' }}>{selectionError}</div>}
          {draft && (
            <form className="pc-pop" role="dialog" aria-label="New comment" style={{ top: draft.at.top, left: Math.max(8, draft.at.left - 180) }}
              onSubmit={(e) => { e.preventDefault(); void saveDraft(); }}>
              <blockquote className="pc-quote">{draft.anchor.exact.length > 120 ? `${draft.anchor.exact.slice(0, 119)}…` : draft.anchor.exact}</blockquote>
              <textarea aria-label="Comment" placeholder="Write a comment" autoFocus value={draftText} disabled={busy === 'draft'} onChange={(e) => setDraftText(e.target.value)} />
              <div className="pc-actions">
                <button type="submit" className="button button--sm button--primary" disabled={busy === 'draft' || !draftText.trim()}>Save</button>
                <button type="button" className="button button--sm button--secondary" disabled={busy === 'draft'} onClick={() => setDraft(null)}>Cancel</button>
              </div>
              {busy === 'draft' && <p className="pc-meta" role="status">Saving...</p>}
              {error?.where === 'draft' && <p className="pc-error" role="alert">{error.message}</p>}
            </form>
          )}
          {panelOpen && (
            <CommentsPanel threads={file?.threads ?? []} anchoring={anchoring} signedIn={signedIn}
              actionsFor={(t) => threadActions(t, `panel:${t.id}`)} busyId={busy?.startsWith('panel:') ? busy.slice(6) : null}
              errorFor={(id) => (error?.where === `panel:${id}` ? error.message : null)}
              onReveal={reveal} onClose={() => { setPanelOpen(false); buttonRef.current?.focus({ preventScroll: true }); }} />
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
