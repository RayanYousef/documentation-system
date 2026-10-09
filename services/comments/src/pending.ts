// On the live site a comment is committed at once but reaches the published comment files only after the
// deploy. Until then the tab keeps the author's latest copy of the page's comments and shows it instead, so
// the author sees their change right away and a reload does not hide it. An entry expires when the site was
// rebuilt from a newer commit (buildSha changed) or after PENDING_COMMENTS_TTL_MS.
import type { CommentsFile } from '@platform/contracts';

export const PENDING_COMMENTS_KEY = 'docs-platform.pending-comments';
export const PENDING_COMMENTS_TTL_MS = 15 * 60 * 1000;

interface Entry { file: CommentsFile; buildSha: string; savedAt: number }

export interface PendingComments {
  /** The page's pending comments, or null (none, expired or from another build). */
  get(page: string, currentBuildSha: string, now?: number): CommentsFile | null;
  save(page: string, file: CommentsFile, buildSha: string, now?: number): void;
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
      const valid = e.buildSha === currentBuildSha && typeof e.savedAt === 'number' && now - e.savedAt >= 0 && now - e.savedAt < PENDING_COMMENTS_TTL_MS
        && !!e.file && Array.isArray(e.file.threads);
      if (valid) return e.file;
      delete all[page];
      write(all);
      return null;
    },
    save(page, file, buildSha, now = Date.now()) { write({ ...read(), [page]: { file, buildSha, savedAt: now } }); },
  };
}
