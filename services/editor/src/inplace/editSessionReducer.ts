// The in-place editing session as a pure state machine:
//   checking-session -> signing-in -> loading -> editing <-> saving -> (exit) | conflict | editing (error)
// Everything the edit bar and the page content show is derived from this state.
import type { Identity, Session } from '@platform/contracts';
import type { Problem } from '@platform/okf-core';
import { readFields, splitDocument, type FrontmatterFields } from '../frontmatter/yamlDoc.js';
import type { EditingMode } from './composeDocument.js';

export type Phase = 'checking-session' | 'signing-in' | 'loading' | 'editing' | 'saving' | 'conflict' | 'error';
export interface Status { kind: 'ok' | 'error' | 'info'; text: string; url?: string | null }

/** What survives a remount of the editor (dev hot reload) for the same page and file version. */
export interface Draft { etag: string; base: string; fields: FrontmatterFields | null; mode: EditingMode; raw: string; body: string | null; message: string }

export interface EditState {
  phase: Phase;
  /** Why the sign-in dialog is shown again (a remembered session stopped working). */
  notice: string;
  session: Session | null;
  identity: Identity | null;
  /** The file as last loaded from (or saved to) the backend, and its etag. */
  loaded: string;
  etag: string;
  /** The text the visual editor shows (the loaded file, or the Raw text after switching back to Visual). */
  base: string;
  /** A body restored from a draft (overrides the body of `base` on the next mount). */
  draftBody: string | null;
  fields: FrontmatterFields | null;
  mode: EditingMode;
  raw: string;
  /** Bumped to remount the rich text editor (new base, reload). */
  bodyKey: number;
  dirty: boolean;
  message: string;
  problems: Problem[];
  status: Status | null;
  error: string;
  /** My version of the file when a save hit a conflict. */
  mine: string;
}

export type EditAction =
  | { type: 'session-ok'; session: Session; identity: Identity }
  | { type: 'need-sign-in'; notice?: string }
  | { type: 'loaded'; text: string; etag: string; draft?: Draft | null }
  | { type: 'load-failed'; error: string }
  | { type: 'edited' }
  | { type: 'fields'; fields: FrontmatterFields }
  | { type: 'raw'; raw: string }
  | { type: 'message'; message: string }
  | { type: 'to-raw'; text: string }
  | { type: 'to-visual' }
  | { type: 'parse-failed' }
  | { type: 'save-start' }
  | { type: 'save-failed'; error: string; problems?: Problem[] }
  | { type: 'conflict'; mine: string; error: string }
  | { type: 'status'; status: Status | null }
  | { type: 'saved'; text: string; etag: string };

export const PARSE_FALLBACK = 'This file could not be opened in the visual editor; editing raw MDX instead.';

export const initialEditState: EditState = {
  phase: 'checking-session', notice: '', session: null, identity: null, loaded: '', etag: '', base: '', draftBody: null,
  fields: null, mode: 'visual', raw: '', bodyKey: 0, dirty: false, message: '', problems: [], status: null, error: '', mine: '',
};

const fieldsOf = (text: string): FrontmatterFields => readFields(splitDocument(text).head);

export function editSessionReducer(s: EditState, a: EditAction): EditState {
  switch (a.type) {
    case 'session-ok': return { ...s, phase: 'loading', session: a.session, identity: a.identity, notice: '' };
    case 'need-sign-in': return { ...s, phase: 'signing-in', session: null, identity: null, notice: a.notice ?? '' };
    case 'loaded': {
      const d = a.draft && a.draft.etag === a.etag ? a.draft : null;
      return {
        ...s, phase: 'editing', loaded: a.text, etag: a.etag, base: d?.base ?? a.text, draftBody: d?.body ?? null,
        fields: d ? d.fields : fieldsOf(a.text), mode: d?.mode ?? 'visual', raw: d?.raw ?? a.text, message: d?.message ?? s.message,
        bodyKey: s.bodyKey + 1, dirty: !!d, problems: [], status: d ? { kind: 'info', text: 'Restored your unsaved edits.' } : null, error: '', mine: '',
      };
    }
    case 'load-failed': return { ...s, phase: 'error', error: a.error };
    case 'edited': return s.dirty ? s : { ...s, dirty: true };
    case 'fields': return { ...s, fields: a.fields, dirty: true };
    case 'raw': return { ...s, raw: a.raw, dirty: true };
    case 'message': return { ...s, message: a.message };
    case 'to-raw': return { ...s, mode: 'raw', raw: a.text };
    case 'to-visual': return { ...s, mode: 'visual', base: s.raw, draftBody: null, fields: fieldsOf(s.raw), bodyKey: s.bodyKey + 1 };
    case 'parse-failed': return { ...s, mode: 'raw', raw: s.mode === 'raw' ? s.raw : s.base, status: { kind: 'error', text: PARSE_FALLBACK } };
    case 'save-start': return { ...s, phase: 'saving', problems: [], status: null };
    case 'save-failed': return { ...s, phase: 'editing', problems: a.problems ?? [], status: { kind: 'error', text: a.error } };
    case 'conflict': return { ...s, phase: 'conflict', mine: a.mine, status: { kind: 'error', text: a.error } };
    case 'status': return { ...s, status: a.status };
    case 'saved': return { ...s, phase: 'editing', loaded: a.text, etag: a.etag, base: a.text, raw: a.text, draftBody: null, fields: fieldsOf(a.text), dirty: false, bodyKey: s.bodyKey + 1 };
    default: return s;
  }
}
