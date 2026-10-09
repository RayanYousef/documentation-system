// On the live site a comment is committed at once but reaches the published comment files only after the
// deploy. Until then the tab keeps the author's latest copy of the page's comments and shows it instead, so
// the author sees their change right away and a reload does not hide it.
//
// A new build is NOT proof that the deploy caught up: deploys are queued, and a build started before the
// author's change can still be published after it (with the old comments). So an entry is kept until the site
// is served from the very commit of the change, or PENDING_COMMENTS_TTL_MS passes. Signed-in editors also read
// the current file from the store when the page loads, which wins over this copy and the published file.
import type { CommentsFile } from '@platform/contracts';

export const PENDING_COMMENTS_KEY = 'docs-platform.pending-comments';
export const PENDING_COMMENTS_TTL_MS = 15 * 60 * 1000;

interface Entry { file: CommentsFile; commitSha: string; savedAt: number }

export interface PendingComments {
  /** The page's pending comments, or null (none, expired, or the served build is the change's own commit). */
  get(page: string, currentBuildSha: string, now?: number): CommentsFile | null;
  /** `commitSha`: the commit of the change ('' when unknown: then only the time limit ends it). */
  save(page: string, file: CommentsFile, commitSha: string, now?: number): void;
}

/** Storage may be missing or throw (private windows, blocked site data): then nothing is remembered. */
export function createPendingComments(storage: () => Storage | null): PendingComments {
  const read = (): Record<string, Entry> => {
    try {
      const raw = storage()?.getItem(PENDING_COMMENTS_KEY);
      const data = raw ? (JSON.parse(raw) as unknown) : {};
      return data && typeof data === 'object' ? (data as Record<string, Entry>) : {};
    } catch { return {}; }
  };
  const write = (all: Record<string, Entry>) => {
    try {
      const s = storage();
      if (!s) return;
      if (Object.keys(all).length) s.setItem(PENDING_COMMENTS_KEY, JSON.stringify(all));
      else s.removeItem(PENDING_COMMENTS_KEY);
    } catch { /* storage blocked */ }
  };
  return {
    get(page, currentBuildSha, now = Date.now()) {
      const all = read();
      const e = all[page];
      if (!e) return null;
      const published = !!e.commitSha && e.commitSha === currentBuildSha;
      const valid = !published && typeof e.savedAt === 'number' && now - e.savedAt >= 0 && now - e.savedAt < PENDING_COMMENTS_TTL_MS
        && !!e.file && Array.isArray(e.file.threads);
      if (valid) return e.file;
      delete all[page];
      write(all);
      return null;
    },
    save(page, file, commitSha, now = Date.now()) { write({ ...read(), [page]: { file, commitSha, savedAt: now } }); },
  };
}
