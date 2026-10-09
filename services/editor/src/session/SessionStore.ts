import type { Session } from '@platform/contracts';

export const SESSION_STORAGE_KEY = 'docs-platform.session';

/** Memory-first session holder; localStorage only when the user opts in ("remember on this device"). */
export class BrowserSessionStore {
  private memory: Session | null = null;
  /** `key`: where a remembered session is kept (the dev server's mock sessions use their own key). */
  constructor(private readonly storage: Storage | null, private readonly key: string = SESSION_STORAGE_KEY) {}
  load(): Session | null {
    if (this.memory) return this.memory;
    try { const raw = this.storage?.getItem(this.key); this.memory = raw ? (JSON.parse(raw) as Session) : null; } catch { this.memory = null; }
    return this.memory;
  }
  save(session: Session, remember: boolean): void {
    this.memory = session;
    try { if (remember) this.storage?.setItem(this.key, JSON.stringify(session)); else this.storage?.removeItem(this.key); } catch { /* storage blocked */ }
  }
  clear(): void { this.memory = null; try { this.storage?.removeItem(this.key); } catch { /* ignore */ } }
}
