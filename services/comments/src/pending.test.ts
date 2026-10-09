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
  it('keeps the latest copy per page until it expires', () => {
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, 'commit-2', 1000);
    expect(p.get('a.md', 'build-1', 2000)).toEqual(file);
    expect(p.get('b.md', 'build-1', 2000)).toBeNull();
    expect(p.get('a.md', 'build-1', 1000 + PENDING_COMMENTS_TTL_MS)).toBeNull();
    expect(s.getItem(PENDING_COMMENTS_KEY)).toBeNull(); // the expired entry is removed
  });

  it('a newer build from an older commit (a deploy that started before the change) keeps the copy', () => {
    // The reported bug: comment at commit A, resolve and delete at B, C; the deploy of A finished after them.
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, 'commit-C', 1000);
    expect(p.get('a.md', 'commit-A', 1001)).toEqual(file);
    expect(p.get('a.md', 'commit-B', 1002)).toEqual(file);
  });

  it('the build of the change\'s own commit (the deploy caught up) drops the copy', () => {
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, 'commit-C', 1000);
    expect(p.get('a.md', 'commit-C', 1001)).toBeNull();
    expect(s.getItem(PENDING_COMMENTS_KEY)).toBeNull();
  });

  it('a change with no known commit is kept for the time limit only', () => {
    const s = new MemoryStorage();
    const p = createPendingComments(() => s as unknown as Storage);
    p.save('a.md', file, '', 1000);
    expect(p.get('a.md', '', 1001)).toEqual(file);
    expect(p.get('a.md', 'any', 1000 + PENDING_COMMENTS_TTL_MS)).toBeNull();
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
