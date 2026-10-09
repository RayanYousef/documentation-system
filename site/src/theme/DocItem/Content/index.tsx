// Wraps the doc content (swizzle --wrap): readers get the original content plus a small Edit button; on
// Edit the editor chunk is loaded and the page is edited in place, in the same content column. After a
// save (or while this tab has a save the deployed site does not show yet) the saved version is shown.
// Nothing here imports the editor: it arrives through the lazy "inplace-editor" chunk.
import React, { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type { WrapperProps } from '@docusaurus/types';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { EditButton } from '@site/src/components/InPlaceEdit/EditButton';
import { onEditRequest, setFlashNotice, takeFlashNotice } from '@site/src/components/InPlaceEdit/editRequest';
import { useEditablePage } from '@site/src/components/InPlaceEdit/useEditablePage';
import { useCommentsEnabled } from '@site/src/components/Comments/useCommentsEnabled';

type Props = WrapperProps<typeof ContentType>;

const loadEditor = () => import(/* webpackChunkName: "inplace-editor" */ '@site/src/platform/inplace/mountInPlaceEditor');
const InPlaceEditorMount = lazy(loadEditor);
const SavedPreviewMount = lazy(() => loadEditor().then((m) => ({ default: m.SavedPreviewMount })));
// Comments: a small chunk of its own, loaded after the page is shown; it never loads the editor.
const CommentsMount = lazy(() => import(/* webpackChunkName: "comments" */ '@site/src/platform/comments/mountComments'));

/** Same key the editor's pendingEdits uses; only checked for presence here (the editor checks expiry). */
const PENDING_EDITS_KEY = 'docs-platform.pending-edits';
function hasPendingEdit(path: string): boolean {
  try { return !!(JSON.parse(sessionStorage.getItem(PENDING_EDITS_KEY) ?? '{}') as Record<string, unknown>)[path]; } catch { return false; }
}

type Saved = { text: string; commitSha: string; commitUrl: string | null };
type View =
  | { kind: 'read' }
  | { kind: 'edit' }
  | { kind: 'saved'; saved?: Saved; contentType: unknown };

const contentTypeOf = (children: ReactNode): unknown => (React.isValidElement(children) ? children.type : null);

export default function ContentWrapper(props: Props) {
  const isBrowser = useIsBrowser();
  const { page } = useEditablePage();
  const commentsOn = useCommentsEnabled();
  const [view, setView] = useState<View>({ kind: 'read' });
  const [notice, setNotice] = useState<string | null>(null);
  // A notice from an editor exit that navigated here (delete -> folder page, rename -> new address).
  useEffect(() => { const m = takeFlashNotice(); if (m) setNotice(m); }, []);
  const contentType = contentTypeOf(props.children);

  const startEdit = useCallback(() => { setNotice(null); setView({ kind: 'edit' }); }, []);
  useEffect(() => (page ? onEditRequest(startEdit) : undefined), [page, startEdit]);

  // A save from this tab that the built page does not show yet.
  useEffect(() => {
    if (page && hasPendingEdit(page.path)) setView((v) => (v.kind === 'read' ? { kind: 'saved', contentType } : v));
  }, [page]); // once per page (contentType is only recorded)

  // The dev server hot-reloaded the saved file: the built content is current again.
  useEffect(() => {
    if (view.kind === 'saved' && view.saved && view.contentType !== contentType) setView({ kind: 'read' });
  }, [view, contentType]);

  const backToRead = useCallback(() => setView({ kind: 'read' }), []);

  if (!isBrowser || !page) return <Content {...props} />;

  // Not while editing: the highlights go away with the layer and come back after the save.
  // Keyed by page: moving to another doc starts with that page's comments only (no card or panel carried over).
  const comments = commentsOn && view.kind !== 'edit' ? <Suspense fallback={null}><CommentsMount key={page.path} page={page} /></Suspense> : null;

  if (view.kind === 'edit') {
    return (
      <Suspense fallback={<><p className="margin-bottom--sm" role="status"><em>Loading editor...</em></p><Content {...props} /></>}>
        <InPlaceEditorMount page={page} onExit={(r) => {
          setNotice(r.notice ?? null);
          setFlashNotice(r.notice ?? null);
          setView(r.saved ? { kind: 'saved', saved: { text: r.saved.text, commitSha: r.saved.commitSha, commitUrl: r.saved.commitUrl }, contentType } : { kind: 'read' });
        }} />
      </Suspense>
    );
  }

  const noticeEl = notice && <div className="alert alert--info margin-bottom--md" role="status">{notice}</div>;
  if (view.kind === 'saved') {
    return (
      <>
        {noticeEl}
        <EditButton onEdit={startEdit} onPrefetch={() => void loadEditor()} before={comments} />
        <Suspense fallback={<Content {...props} />}>
          <SavedPreviewMount page={page} saved={view.saved} onGone={backToRead} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      {noticeEl}
      <EditButton onEdit={startEdit} onPrefetch={() => void loadEditor()} before={comments} />
      <Content {...props} />
    </>
  );
}
