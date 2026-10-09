// Saves on the live site land on GitHub at once but reach the public pages only after the deploy (and
// the Pages CDN cache, about 10 minutes). Until then the saved text is kept per tab and shown in place
// of the built page, so a reload does not look like a lost save. An entry expires when the site was
// rebuilt from a newer commit (buildSha changed) or after PENDING_TTL_MS.

export const PENDING_EDITS_KEY = 'docs-platform.pending-edits';
export const PENDING_TTL_MS = 15 * 60 * 1000;

export interface PendingEdit {
  text: string;
  commitSha: string;
  commitUrl: string | null;
  /** buildSha of the site that was showing when the save happened. */
  buildSha: string;
  /** Epoch milliseconds. */
  savedAt: number;
}

export interface PendingEdits {
  /** The pending edit of a page, or null when there is none or it expired (expired entries are removed). */
  get(path: string, currentBuildSha: string, now?: number): PendingEdit | null;
  save(path: string, edit: PendingEdit): void;
  clear(path: string): void;
}

/** Storage may be missing or throw (private windows, blocked site data): then nothing is remembered. */
export function createPendingEdits(storage: () => Storage | null): PendingEdits {
  const read = (): Record<string, PendingEdit> => {
    try {
      const raw = storage()?.getItem(PENDING_EDITS_KEY);
      const data = raw ? (JSON.parse(raw) as unknown) : {};
      return data && typeof data === 'object' ? (data as Record<string, PendingEdit>) : {};
    } catch { return {}; }
  };
  const write = (all: Record<string, PendingEdit>) => {
    try {
      const s = storage();
      if (!s) return;
      if (Object.keys(all).length) s.setItem(PENDING_EDITS_KEY, JSON.stringify(all));
      else s.removeItem(PENDING_EDITS_KEY);
    } catch { /* storage blocked */ }
  };
  return {
    get(path, currentBuildSha, now = Date.now()) {
      const all = read();
      const e = all[path];
      if (!e) return null;
      const valid = typeof e.text === 'string' && e.buildSha === currentBuildSha && typeof e.savedAt === 'number' && now - e.savedAt >= 0 && now - e.savedAt < PENDING_TTL_MS;
      if (valid) return e;
      delete all[path];
      write(all);
      return null;
    },
    save(path, edit) { write({ ...read(), [path]: edit }); },
    clear(path) { const all = read(); delete all[path]; write(all); },
  };
}

/** The tab's pending edits (sessionStorage). */
export const pendingEdits: PendingEdits = createPendingEdits(() => (typeof sessionStorage === 'undefined' ? null : sessionStorage));
