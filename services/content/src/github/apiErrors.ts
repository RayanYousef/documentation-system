import { ContentError } from '@platform/contracts';

/** Why GitHub refused a request; carried in `ContentError.details` so the editor can react without parsing text. */
export type RefusalReason = 'token-expired' | 'cannot-write' | 'cannot-read' | 'rate-limited' | 'branch-protected';
export interface Refusal { reason: RefusalReason; retryAfterSeconds?: number }

export interface FailedResponse {
  status: number;
  method: string;
  path: string;
  /** Header lookup (case-insensitive, like Headers.get). */
  header(name: string): string | null;
  /** GitHub's own `message` field, '' when the body had none. */
  message: string;
  now?: number;
}

const refused = (message: string, details: Refusal) => new ContentError('FORBIDDEN', message, details);

/** "about 2 minutes" / "45 seconds": the wait a person should expect. */
export function describeWait(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} minutes`;
}

function rateLimitWait(r: FailedResponse): number | null {
  const retryAfter = Number(r.header('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter;
  const reset = Number(r.header('x-ratelimit-reset'));
  if (r.header('x-ratelimit-remaining') === '0' && Number.isFinite(reset) && reset > 0) return Math.max(1, reset - Math.floor((r.now ?? Date.now()) / 1000));
  return null;
}

/**
 * Turns a 401, 403, 429 or protected-branch 422 into a ContentError a person can act on, or null when the
 * response is not one of those (the caller then handles 404, 409, 422 conflicts and the rest).
 */
export function refusalFor(r: FailedResponse, owner: string, repo: string): ContentError | null {
  const text = r.message.toLowerCase();
  const rateLimited = r.status === 429 || (r.status === 403 && (r.header('x-ratelimit-remaining') === '0' || r.header('retry-after') !== null || text.includes('rate limit')));
  if (rateLimited) {
    const wait = rateLimitWait(r);
    const when = wait === null ? 'Wait a few minutes' : `Wait ${describeWait(wait)}`;
    return refused(`GitHub is limiting how fast this token can make requests (rate limit). ${when}, then save again. Your edits are still on the page.`, { reason: 'rate-limited', ...(wait === null ? {} : { retryAfterSeconds: Math.round(wait) }) });
  }
  if ((r.status === 403 || r.status === 422) && text.includes('protected branch')) {
    const ref = /refs\/heads\/([^\s.]+)/.exec(r.message)?.[1] ?? r.path.match(/\/git\/refs\/heads\/([^/?]+)/)?.[1] ?? 'main';
    return refused(`The branch "${decodeURIComponent(ref)}" is protected, so GitHub refused the save. Ask a repository admin to let this account push to it. Your edits are still on the page.`, { reason: 'branch-protected' });
  }
  if (r.status === 401) {
    return refused('Your GitHub token has expired or was revoked. Sign out from the Page actions menu, then sign in with a new token. Your edits are still on the page.', { reason: 'token-expired' });
  }
  if (r.status === 403) {
    if (r.method !== 'GET') {
      return refused('This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write (see "Create your token" in the Editor docs), then sign in again. Your edits are still on the page.', { reason: 'cannot-write' });
    }
    return refused(`This token cannot read ${owner}/${repo}. Check that it is scoped to that repository and has not expired.`, { reason: 'cannot-read' });
  }
  return null;
}
