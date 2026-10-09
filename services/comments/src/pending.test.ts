import { describe, it, expect } from 'vitest';
import { emptyCommentsFile } from '@platform/contracts';
import { createPendingComments, PENDING_COMMENTS_KEY, PENDING_COMMENTS_TTL_MS } from './pending.js';

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const file = { ...emptyCommentsFile('a.md'), threads: [{ id: 'c1', body: 'x', author: { login: 'm', name: 'M' }, createdAt: '', status: 'open' as const, replies: [], anchor: { exact: 'x', prefix: '', suffix: '', tab: null } }] };

describe('pending comments', () => {
  it('keeps the latest copy per page for the same build until it expires', () => {
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, 'build-1', 1000);
    expect(p.get('a.md', 'build-1', 2000)).toEqual(file);
    expect(p.get('b.md', 'build-1', 2000)).toBeNull();
    expect(p.get('a.md', 'build-1', 1000 + PENDING_COMMENTS_TTL_MS)).toBeNull();
    expect(s.getItem(PENDING_COMMENTS_KEY)).toBeNull(); // the expired entry is removed
  });

  it('a newer build (the deploy finished) drops the copy', () => {
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, 'build-1', 1000);
    expect(p.get('a.md', 'build-2', 1001)).toBeNull();
  });

  it('works without storage and with corrupt storage', () => {
    expect(createPendingComments(() => null).get('a.md', 'b', 1)).toBeNull();
    const s = new MemoryStorage();
    s.setItem(PENDING_COMMENTS_KEY, '{oops');
    expect(createPendingComments(() => s as unknown as Storage).get('a.md', 'b', 1)).toBeNull();
    const thrower = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    const p = createPendingComments(() => thrower as unknown as Storage);
    expect(() => p.save('a.md', file, 'b', 1)).not.toThrow();
    expect(p.get('a.md', 'b', 1)).toBeNull();
  });
});
