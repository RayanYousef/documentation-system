import { describe, it, expect } from 'vitest';
import { createPendingEdits, PENDING_EDITS_KEY, PENDING_TTL_MS, type PendingEdit } from './pendingEdits.js';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const edit = (over: Partial<PendingEdit> = {}): PendingEdit => ({ text: 'saved', commitSha: 'abc1234', commitUrl: null, buildSha: 'build-1', savedAt: 1_000, ...over });

describe('pendingEdits', () => {
  it('returns a saved edit while the build and the TTL hold', () => {
    const store = new MemoryStorage();
    const p = createPendingEdits(() => store);
    p.save('a.md', edit());
    expect(p.get('a.md', 'build-1', 1_000 + PENDING_TTL_MS - 1)).toMatchObject({ text: 'saved' });
    expect(p.get('b.md', 'build-1', 1_000)).toBeNull();
  });

  it('expires when the site was rebuilt from a newer commit', () => {
    const store = new MemoryStorage();
    const p = createPendingEdits(() => store);
    p.save('a.md', edit());
    expect(p.get('a.md', 'build-2', 1_000)).toBeNull();
    expect(store.getItem(PENDING_EDITS_KEY)).toBeNull(); // removed
  });

  it('expires after the TTL', () => {
    const store = new MemoryStorage();
    const p = createPendingEdits(() => store);
    p.save('a.md', edit());
    p.save('b.md', edit({ text: 'other' }));
    expect(p.get('a.md', 'build-1', 1_000 + PENDING_TTL_MS)).toBeNull();
    expect(p.get('b.md', 'build-1', 1_000)).toMatchObject({ text: 'other' });
  });

  it('clears one page', () => {
    const store = new MemoryStorage();
    const p = createPendingEdits(() => store);
    p.save('a.md', edit());
    p.clear('a.md');
    expect(p.get('a.md', 'build-1', 1_000)).toBeNull();
  });

  it('survives missing, throwing or corrupt storage', () => {
    expect(createPendingEdits(() => null).get('a.md', 'b', 0)).toBeNull();
    const throwing = createPendingEdits(() => { throw new Error('blocked'); });
    expect(() => throwing.save('a.md', edit())).not.toThrow();
    expect(throwing.get('a.md', 'build-1', 1_000)).toBeNull();
    const store = new MemoryStorage();
    store.setItem(PENDING_EDITS_KEY, '{not json');
    expect(createPendingEdits(() => store).get('a.md', 'build-1', 1_000)).toBeNull();
  });
});
