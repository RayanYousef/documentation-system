// Drives the editing session's asynchronous steps (verify a remembered session, load the page) around
// the pure editSessionReducer.
import { useEffect, useMemo, useReducer } from 'react';
import { CURRENT_VERSION, type ContentBackend, type Identity } from '@platform/contracts';
import type { EditablePage, InPlaceHost } from '../host.js';
import { editSessionReducer, initialEditState, type Draft, type EditAction, type EditState } from './editSessionReducer.js';

/** Sessions already verified in this tab (token -> identity): a remembered session is checked once per tab. */
const verified = new Map<string, Identity>();
export const rememberVerified = (token: string, identity: Identity): void => { verified.set(token, identity); };
export const forgetVerifiedSessions = (): void => { verified.clear(); };

/** Unsaved drafts by page path, so a remount (dev hot reload, route data refresh) restores the edits. */
export const drafts = new Map<string, Draft>();

export function useEditSession(host: InPlaceHost, page: EditablePage): { state: EditState; dispatch: (a: EditAction) => void; backend: ContentBackend | null } {
  const [state, dispatch] = useReducer(editSessionReducer, initialEditState);
  const backend = useMemo(() => (state.session ? host.backend(state.session) : null), [host, state.session]);

  useEffect(() => {
    if (state.phase !== 'checking-session') return undefined;
    let cancelled = false;
    const stored = host.sessionStore.load();
    if (!stored) { dispatch({ type: 'need-sign-in' }); return undefined; }
    const known = verified.get(stored.token);
    if (known) { dispatch({ type: 'session-ok', session: stored, identity: known }); return undefined; }
    host.auth.verify(stored).then(
      (identity) => { verified.set(stored.token, identity); if (!cancelled) dispatch({ type: 'session-ok', session: stored, identity }); },
      (e: Error) => { host.sessionStore.clear(); if (!cancelled) dispatch({ type: 'need-sign-in', notice: `Your saved session is no longer valid and was forgotten. ${e.message}` }); },
    );
    return () => { cancelled = true; };
  }, [state.phase, host]);

  useEffect(() => {
    if (state.phase !== 'loading' || !backend) return undefined;
    let cancelled = false;
    backend.readPage(CURRENT_VERSION, page.path).then(
      (p) => { if (!cancelled) dispatch({ type: 'loaded', text: p.text, etag: p.etag, draft: drafts.get(page.path) ?? null }); },
      (e: Error) => { if (!cancelled) dispatch({ type: 'load-failed', error: `Could not load ${page.path}: ${e.message}` }); },
    );
    return () => { cancelled = true; };
  }, [state.phase, backend, page.path]);

  return { state, dispatch, backend };
}
