// Edits a docs page where it is shown. Mounted by the site (lazily, on Edit) inside the page's content
// column; everything it needs from outside comes through the InPlaceHost and the optional skin.
//
// Flow: remembered session? -> verify (once per tab) | sign-in dialog -> load the page -> edit -> save.
// Save commits through ContentBackend.writePage (expected etag = the loaded version) and hands the saved
// text back to the site with onExit({ saved }).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ContentError, CURRENT_VERSION, type ComponentsManifest, type Identity } from '@platform/contracts';
import { validatePage, type Problem } from '@platform/okf-core';
import type { EditablePage, InPlaceHost } from '../host.js';
import { BodyEditor } from '../components/BodyEditor.js';
import { NewPageDialog } from '../components/NewPageDialog.js';
import { ProblemList } from '../components/ProblemList.js';
import { PublishDialog } from '../components/PublishDialog.js';
import { splitDocument, type FrontmatterFields } from '../frontmatter/yamlDoc.js';
import { DEFAULT_COMPONENTS, loadComponentsManifest } from '../mdx/componentsManifest.js';
import { RawTextEditor } from '../rawtext/index.js';
import type { RichTextHandle } from '../richtext/index.js';
import { RichTextSkinProvider, type RichTextSkin } from '../richtext/skin.js';
import { composeDocument, type EditingMode } from './composeDocument.js';
import { EditBar } from './EditBar.js';
import { folderIntroProblem } from './folderIntroGuard.js';
import { InlineTitle } from './InlineTitle.js';
import { InPlaceContext, type InPlaceSession } from './InPlaceContext.js';
import { PageActionsMenu, type PageAction } from './PageActionsMenu.js';
import { DeletePageDialog, RenamePageDialog } from './PageDialogs.js';
import { PageSettingsPanel } from './PageSettingsPanel.js';
import { pendingEdits } from './pendingEdits.js';
import { SignInDialog } from './SignInDialog.js';
import { drafts, forgetVerifiedSessions, rememberVerified, useEditSession } from './useEditSession.js';
import { DISCARD_PROMPT, useUnsavedGuard } from './useUnsavedGuard.js';

export interface SavedResult { text: string; commitSha: string; commitUrl: string | null; regenerated: string[] }
export interface InPlaceExit {
  /** The page was saved; `text` is what was written. */
  saved?: SavedResult;
  /** Something to tell the reader after the editor closed (rename/delete/new page outcome). */
  notice?: string;
}

export interface InPlaceEditorProps {
  host: InPlaceHost;
  page: EditablePage;
  skin?: RichTextSkin;
  onExit(result: InPlaceExit): void;
}

const authorOf = (id: Identity) => ({ name: id.name, email: id.email ?? `${id.login}@users.noreply.github.com` });
const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');
/** A Markdown body that starts with its own `# Title` (Docusaurus then shows that instead of the frontmatter title). */
const bodyHasH1 = (body: string) => /^\s*#\s/.test(body);

export function InPlaceEditor({ host, page, skin, onExit }: InPlaceEditorProps) {
  const { state, dispatch, backend } = useEditSession(host, page);
  const body = useRef<RichTextHandle>(null);
  const [components, setComponents] = useState<ComponentsManifest>(DEFAULT_COMPONENTS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | 'publish' | null>(null);
  const [versions, setVersions] = useState<string[]>([]);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const exited = useRef(false);
  const defaultMessage = page.isIndex ? `Update ${page.path} intro` : `Update ${page.title}`;

  useEffect(() => { void loadComponentsManifest(host.componentsUrl).then(setComponents); }, [host.componentsUrl]);
  // Leaving with "discard" confirmed: the unmount that follows must not keep the edits as a draft.
  useUnsavedGuard(state.dirty, host.navigation, () => { exited.current = true; drafts.delete(page.path); });

  const exit = useCallback((result: InPlaceExit) => {
    exited.current = true;
    drafts.delete(page.path);
    onExit(result);
  }, [onExit, page.path]);

  // Unmounted without Save or Cancel (dev hot reload, route data refresh): keep the draft for the next mount.
  const snapshot = useRef<() => void>(() => {});
  snapshot.current = () => {
    if (exited.current || !state.dirty || (state.phase !== 'editing' && state.phase !== 'conflict')) return;
    drafts.set(page.path, { etag: state.etag, base: state.base, fields: state.fields, mode: state.mode, raw: state.raw, body: state.mode === 'visual' ? body.current?.getMarkdown() ?? null : null, message: state.message });
  };
  useLayoutEffect(() => () => snapshot.current(), []);

  const compose = useCallback((): string => composeDocument({
    base: state.base,
    fields: state.fields,
    body: state.mode === 'visual' ? body.current?.getMarkdown() ?? state.draftBody : null,
    mode: state.mode,
    raw: state.raw,
  }), [state.base, state.fields, state.mode, state.raw, state.draftBody]);

  const session: InPlaceSession | null = useMemo(() => (state.session && state.identity && backend ? {
    host, session: state.session, identity: state.identity, backend,
    signOut: () => { host.sessionStore.clear(); forgetVerifiedSessions(); exit({ notice: 'Signed out.' }); },
  } : null), [host, state.session, state.identity, backend, exit]);

  const confirmDiscard = () => !state.dirty || window.confirm(DISCARD_PROMPT);

  const cancel = () => { if (confirmDiscard()) exit({}); };

  const switchMode = (next: EditingMode) => {
    if (next === 'raw') dispatch({ type: 'to-raw', text: compose() });
    else dispatch({ type: 'to-visual' });
  };

  const save = async () => {
    if (!session || state.phase !== 'editing') return;
    const next = compose();
    const intro = page.isIndex ? folderIntroProblem(state.loaded, next) : null;
    if (intro) { dispatch({ type: 'save-failed', error: intro }); return; }
    const local: Problem[] = page.isIndex ? [] : validatePage(page.path, next, { codeRepos: host.config.codeRepos });
    if (local.length) { dispatch({ type: 'save-failed', error: 'Fix the problems below before saving.', problems: local }); return; }
    dispatch({ type: 'save-start' });
    try {
      const res = await session.backend.writePage(CURRENT_VERSION, page.path, next, { message: state.message.trim() || defaultMessage, author: authorOf(session.identity), expectedEtag: state.etag });
      if (host.mode === 'github') pendingEdits.save(page.path, { text: next, commitSha: res.commitSha, commitUrl: res.commitUrl, buildSha: host.buildSha, savedAt: Date.now() });
      dispatch({ type: 'saved', text: next, etag: res.etag }); // clean again: releases the unsaved-changes guard
      exit({ saved: { text: next, commitSha: res.commitSha, commitUrl: res.commitUrl ?? (res.commitSha ? host.urls.commitUrl(res.commitSha) : null), regenerated: res.regenerated } });
    } catch (e) {
      if (e instanceof ContentError && e.code === 'CONFLICT') dispatch({ type: 'conflict', mine: next, error: `${e.message}.` });
      else dispatch({ type: 'save-failed', error: (e as Error).message, problems: e instanceof ContentError && e.code === 'VALIDATION' && Array.isArray(e.details) ? (e.details as Problem[]) : [] });
    }
  };

  const reloadLatest = async () => {
    if (!session) return;
    try {
      const p = await session.backend.readPage(CURRENT_VERSION, page.path);
      drafts.delete(page.path);
      dispatch({ type: 'loaded', text: p.text, etag: p.etag });
      dispatch({ type: 'status', status: { kind: 'info', text: 'Loaded the latest version. Re-apply your edits (your version may still be on the clipboard).' } });
    } catch (e) { dispatch({ type: 'status', status: { kind: 'error', text: (e as Error).message } }); }
  };

  const copyMine = async () => {
    try { await navigator.clipboard.writeText(state.mine); } catch { /* clipboard blocked: the text is still shown in Raw */ }
    dispatch({ type: 'to-raw', text: state.mine });
    dispatch({ type: 'status', status: { kind: 'info', text: 'Your version is on the clipboard and shown in Raw. Reload the latest version, then paste and merge your changes.' } });
  };

  const onAction = async (action: PageAction) => {
    if (!session) return;
    if (action === 'sign-out') { if (confirmDiscard()) session.signOut(); return; }
    if (action === 'publish') {
      try { setVersions((await session.backend.listVersions()).map((v) => v.id)); } catch { setVersions([]); }
    }
    setDialog(action);
  };

  const pageOp = async (fn: () => Promise<void>) => { await fn(); setDialog(null); };
  const author = session ? authorOf(session.identity) : null;

  const createPage = (path: string, text: string) => pageOp(async () => {
    await session!.backend.createPage(CURRENT_VERSION, path, text, { message: `Add ${path}`, author: author! });
    const url = host.urls.pageUrl(path);
    if (host.mode === 'local-disk' && url) { if (!state.dirty || window.confirm(DISCARD_PROMPT)) { exit({ notice: `Created ${path}.` }); host.navigate(url); } return; }
    dispatch({ type: 'status', status: { kind: 'ok', text: `Created ${path}. It appears on the site after the deploy finishes.`, url: null } });
  });

  const renamePage = (to: string) => pageOp(async () => {
    await session!.backend.renamePage(CURRENT_VERSION, page.path, to, { message: `Rename ${page.path} to ${to}`, author: author! });
    const url = host.urls.pageUrl(to);
    exit({ notice: host.mode === 'local-disk' ? `Renamed to ${to}.` : `Renamed to ${to}. The new address works after the deploy finishes.` });
    if (host.mode === 'local-disk' && url) host.navigate(url);
  });

  const deletePage = () => pageOp(async () => {
    await session!.backend.deletePage(CURRENT_VERSION, page.path, { message: `Delete ${page.path}`, author: author! });
    const folder = folderOf(page.path);
    exit({ notice: host.mode === 'local-disk' ? `Deleted ${page.path}.` : `Deleted ${page.path}. The page disappears from the site after the deploy finishes.` });
    host.navigate(host.urls.pageUrl(folder ? `${folder}/index.md` : 'index.md') ?? host.config.baseUrl);
  });

  const publish = (version: string) => pageOp(async () => {
    const res = await session!.backend.publishVersion(version, { message: `Publish docs ${version}`, author: author! });
    dispatch({ type: 'status', status: { kind: 'ok', text: `Published ${res.version} (tag ${res.tag}, commit ${res.commitSha.slice(0, 7)}).`, url: host.urls.commitUrl(res.commitSha) } });
  });

  // ----- render -----

  if (state.phase === 'checking-session') return <div className="ped-ui"><p className="ped-loading">Checking your sign-in...</p></div>;
  if (state.phase === 'signing-in') {
    return (
      <div className="ped-ui">
        <SignInDialog host={host} initialError={state.notice}
          onCancel={() => exit({})}
          onSignedIn={(s, identity, remember) => { host.sessionStore.save(s, remember); rememberVerified(s.token, identity); host.onSignedIn?.(); dispatch({ type: 'session-ok', session: s, identity }); }} />
      </div>
    );
  }
  if (state.phase === 'error') {
    return (
      <div className="ped-ui">
        <p className="ped-problems" role="alert">{state.error}</p>
        <button type="button" className="ped-btn ped-btn--secondary" onClick={() => exit({})}>Close</button>
      </div>
    );
  }
  if (state.phase === 'loading' || !session) return <div className="ped-ui"><p className="ped-loading">Loading the editor...</p></div>;

  const saving = state.phase === 'saving';
  const fields = state.fields;
  const bodyMarkdown = state.draftBody ?? splitDocument(state.base).body;
  const showTitle = !!fields && !bodyHasH1(bodyMarkdown) && state.mode === 'visual';
  const setFields = (f: FrontmatterFields) => dispatch({ type: 'fields', fields: f });
  const folder = folderOf(page.path);
  const firstRepo = host.config.codeRepos[0];
  const rootStyle = barHeight === null ? undefined : ({ '--ped-editbar-height': `${barHeight}px` } as CSSProperties);

  return (
    <InPlaceContext.Provider value={session}>
      <RichTextSkinProvider skin={skin ?? {}}>
        <div className="ped-ui" data-platform-editing="" style={rootStyle}>
          <EditBar
            mode={state.mode} onMode={switchMode}
            settingsOpen={page.isIndex ? null : settingsOpen} onToggleSettings={() => setSettingsOpen(!settingsOpen)}
            actions={<PageActionsMenu who={session.identity.name} canPageOps={host.capabilities.pageOps} canPublish={host.capabilities.publish && session.identity.role === 'editor'} isIndex={page.isIndex} disabled={saving} onAction={(a) => void onAction(a)} />}
            message={state.message} defaultMessage={defaultMessage} onMessage={(m) => dispatch({ type: 'message', message: m })}
            dirty={state.dirty} saving={saving} canSave={state.phase === 'editing'} onCancel={cancel} onSave={() => void save()}
            status={state.status} onHeight={setBarHeight} />
          {state.phase === 'conflict' && (
            <div className="ped-conflict ped-chrome" role="alert">
              <strong>Someone else changed this page since you opened it.</strong> Nothing was overwritten.
              <div className="ped-conflict-actions">
                <button type="button" className="ped-btn ped-btn--secondary" onClick={() => void copyMine()}>Copy my version (Raw)</button>
                <button type="button" className="ped-btn" onClick={() => void reloadLatest()}>Reload latest</button>
              </div>
            </div>
          )}
          <ProblemList problems={state.problems} title="Validation problems" />
          {settingsOpen && !page.isIndex && fields && state.mode === 'visual' && (
            <PageSettingsPanel backend={session.backend} fields={fields} readOnly={saving} onChange={setFields} />
          )}
          <div className="theme-doc-markdown markdown">
            {showTitle && <InlineTitle value={fields.title} readOnly={saving} onChange={(title) => setFields({ ...fields, title })} />}
            {state.mode === 'raw'
              ? <RawTextEditor value={state.raw} readOnly={saving} ariaLabel="Raw MDX" onChange={(raw) => dispatch({ type: 'raw', raw })} />
              : <BodyEditor key={state.bodyKey} editorRef={body} markdown={bodyMarkdown} fileLabel={page.path} components={components} readOnly={saving}
                  onChange={() => dispatch({ type: 'edited' })}
                  onParseError={(e) => { console.warn('Rich text parse error', e.error); dispatch({ type: 'parse-failed' }); }} />}
          </div>
          {dialog === 'new' && <NewPageDialog typesInUse={[]} defaultPath={folder ? `${folder}/` : ''}
            defaultResource={firstRepo ? `https://github.com/${firstRepo.owner}/${firstRepo.repo}/blob/${firstRepo.defaultRef}/${firstRepo.pathPrefix ?? ''}` : ''}
            onCreate={createPage} onClose={() => setDialog(null)} />}
          {dialog === 'rename' && <RenamePageDialog path={page.path} dirty={state.dirty} onRename={renamePage} onClose={() => setDialog(null)} />}
          {dialog === 'delete' && <DeletePageDialog path={page.path} dirty={state.dirty} onDelete={deletePage} onClose={() => setDialog(null)} />}
          {dialog === 'publish' && <PublishDialog existing={versions} onPublish={publish} onClose={() => setDialog(null)} />}
        </div>
      </RichTextSkinProvider>
    </InPlaceContext.Provider>
  );
}
