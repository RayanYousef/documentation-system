// The signed-in editor for comments, loaded lazily on the first comment action (readers never load it). It
// uses the same sign-in, session store and verified-session cache as the in-place editor, and picks the
// CommentStore for the mode: commits to the deploy branch on GitHub, or the dev server's disk endpoint.
import { AuthError, type PlatformConfig, type Session, type Identity } from '@platform/contracts';
import { GithubCommentStore, HttpCommentStore } from '@platform/content/comments';
import type { CommentEditor } from '@platform/comments';
import { rememberVerified, verifiedIdentity } from '@platform/editor/signin';
import { resolveEditAccess, type EditAccess, type InPlaceGlobalData } from '../inplace/editAccess';
import { showSignInDialog } from '../inplace/showSignInDialog';

/** The site's own content backend (viewers, private assets) picks up a new token after a sign-in. */
export { resetContentBackend } from '../createContentBackend';

export interface CommentSessionDeps {
  config: PlatformConfig;
  global: InPlaceGlobalData;
  /** After a new sign-in (the site's own content backend picks up the token). */
  onSignedIn?(): void;
  fetch?: typeof fetch;
  storage?: Storage | null;
  /** Shows the sign-in dialog (tests replace it). */
  signInDialog?: typeof showSignInDialog;
}

export function commentEditorFor(access: EditAccess, config: PlatformConfig, session: Session, identity: Identity, f?: typeof fetch): CommentEditor {
  const store = access.dev
    ? new HttpCommentStore(access.dev.endpoint, access.dev.fetch)
    : new GithubCommentStore({ owner: config.organizationName, repo: config.projectName, branch: config.deployBranch, sitePath: config.sitePath, token: session.token, fetch: f });
  return { identity, store };
}

/**
 * The editor of the session saved on this device, never asking to sign in: null when there is no session or
 * it cannot be checked or used (the next comment action asks, through obtainCommentEditor).
 */
export async function currentCommentEditor(deps: CommentSessionDeps): Promise<CommentEditor | null> {
  try {
    const access = await resolveEditAccess(deps);
    const stored = access.sessionStore.load();
    if (!stored) return null;
    let identity = verifiedIdentity(stored.token);
    if (!identity) {
      identity = await access.auth.verify(stored);
      rememberVerified(stored.token, identity);
    }
    return commentEditorFor(access, deps.config, stored, identity, deps.fetch);
  } catch {
    return null;
  }
}

/** The verified editor (asking to sign in when there is no working session), or null when cancelled. */
export async function obtainCommentEditor(deps: CommentSessionDeps): Promise<CommentEditor | null> {
  const access = await resolveEditAccess(deps);
  const dialog = deps.signInDialog ?? showSignInDialog;
  let notice: string | undefined;
  const stored = access.sessionStore.load();
  if (stored) {
    const known = verifiedIdentity(stored.token);
    if (known) return commentEditorFor(access, deps.config, stored, known, deps.fetch);
    try {
      const identity = await access.auth.verify(stored);
      rememberVerified(stored.token, identity);
      return commentEditorFor(access, deps.config, stored, identity, deps.fetch);
    } catch (e) {
      if (e instanceof AuthError && e.code === 'NETWORK') throw new Error(`Could not check your saved sign-in. ${e.message}`);
      access.sessionStore.clear();
      notice = `Your saved session is no longer valid and was forgotten. ${(e as Error).message}`;
    }
  }
  const signed = await dialog({ auth: access.auth, config: deps.config, mode: access.mode }, notice);
  if (!signed) return null;
  access.sessionStore.save(signed.session, signed.remember);
  rememberVerified(signed.session.token, signed.identity);
  if (access.mode === 'github') deps.onSignedIn?.();
  return commentEditorFor(access, deps.config, signed.session, signed.identity, deps.fetch);
}
