import { describe, it, expect } from 'vitest';
import { readPublishedComments } from './published.js';

const PAGE = 'systems/inventory.md';
const author = { login: 'mira', name: 'Mira' };
const good = {
  id: 'c1', body: 'Why?', author, createdAt: '2026-10-09T10:00:00.000Z', status: 'open', replies: [],
  anchor: { exact: 'stored', prefix: 'how items are ', suffix: ' and', tab: null },
};

describe('readPublishedComments', () => {
  it('keeps a well-formed file as it is', () => {
    const file = { schema: 1, page: PAGE, threads: [good] };
    expect(readPublishedComments(file, PAGE)).toEqual(file);
  });

  it('anything that is not a comments file reads as an empty one', () => {
    for (const bad of [null, 'x', 3, {}, { schema: 2, threads: [] }, { schema: 1, threads: 'no' }]) {
      expect(readPublishedComments(bad, PAGE)).toEqual({ schema: 1, page: PAGE, threads: [] });
    }
  });

  it('skips threads the page could not render or anchor (wrong types), keeps the rest', () => {
    const broken = [
      { ...good, id: 'no-prefix', anchor: { exact: 'stored', suffix: '', tab: null } },
      { ...good, id: 'empty-exact', anchor: { ...good.anchor, exact: '' } },
      { ...good, id: 'bad-tab', anchor: { ...good.anchor, tab: { group: '0', value: 'a', label: 'A' } } },
      { ...good, id: 'login-object', author: { login: { html: '<b>' }, name: 'x' } },
      { ...good, id: 'body-number', body: 5 },
      { ...good, id: 'no-date', createdAt: undefined },
      { ...good, id: 'bad-resolver', status: 'resolved', resolvedBy: 'rita' },
      { ...good, id: 'bad-status', status: 'closed' },
    ];
    const out = readPublishedComments({ schema: 1, page: PAGE, threads: [...broken, good] }, PAGE);
    expect(out.threads.map((t) => t.id)).toEqual(['c1']);
  });

  it('skips malformed replies of a thread and keeps the thread', () => {
    const replies = [
      { id: 'r1', body: 'Fine.', author, createdAt: '2026-10-09T11:00:00.000Z' },
      { id: 'r2', body: 'x', author: { login: ['a'] }, createdAt: '2026-10-09T11:00:00.000Z' },
      { id: 'r3', body: 'x', author },
      null,
    ];
    const out = readPublishedComments({ schema: 1, page: PAGE, threads: [{ ...good, replies }] }, PAGE);
    expect(out.threads[0]!.replies.map((r) => r.id)).toEqual(['r1']);
  });
});
