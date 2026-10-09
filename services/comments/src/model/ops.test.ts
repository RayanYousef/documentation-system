import { describe, it, expect } from 'vitest';
import { ContentError, emptyCommentsFile, type CommentStore, type CommentWriteOptions, type CommentsFile } from '@platform/contracts';
import { applyOp, commitMessage, type CommentOp } from './ops.js';
import { changeComments } from './changeComments.js';

const mira = { login: 'mira', name: 'Mira Okonkwo' };
const rita = { login: 'rita', name: 'Rita' };
const anchor = { exact: 'stored', prefix: 'how items are ', suffix: ' and moved', tab: null };
const PAGE = 'systems/inventory.md';
const add = (id: string, body = 'Why?'): CommentOp => ({ kind: 'add', id, anchor, body, author: mira, at: '2026-10-09T10:00:00.000Z' });

describe('applyOp', () => {
  it('adds an open thread with no replies, in the order they were made', () => {
    const f = applyOp(applyOp(emptyCommentsFile(PAGE), add('a')), add('b', 'Second'));
    expect(f.threads.map((t) => [t.id, t.status, t.body, t.replies.length])).toEqual([['a', 'open', 'Why?', 0], ['b', 'open', 'Second', 0]]);
    expect(f.threads[0]).toMatchObject({ author: mira, createdAt: '2026-10-09T10:00:00.000Z', anchor });
  });

  it('replies, resolves (who and when), reopens and deletes without touching other threads', () => {
    let f = applyOp(applyOp(emptyCommentsFile(PAGE), add('a')), add('b'));
    f = applyOp(f, { kind: 'reply', threadId: 'a', id: 'r1', body: 'Because.', author: rita, at: '2026-10-09T11:00:00.000Z' });
    expect(f.threads[0]!.replies).toEqual([{ id: 'r1', body: 'Because.', author: rita, createdAt: '2026-10-09T11:00:00.000Z' }]);
    f = applyOp(f, { kind: 'resolve', threadId: 'a', author: rita, at: '2026-10-09T12:00:00.000Z' });
    expect(f.threads[0]).toMatchObject({ status: 'resolved', resolvedBy: rita, resolvedAt: '2026-10-09T12:00:00.000Z' });
    f = applyOp(f, { kind: 'reopen', threadId: 'a' });
    expect(f.threads[0]!.status).toBe('open');
    expect(f.threads[0]!.resolvedBy).toBeUndefined();
    f = applyOp(f, { kind: 'delete', threadId: 'a' });
    expect(f.threads.map((t) => t.id)).toEqual(['b']);
  });

  it('does not change the file it was given', () => {
    const before = applyOp(emptyCommentsFile(PAGE), add('a'));
    const copy = JSON.parse(JSON.stringify(before)) as CommentsFile;
    applyOp(before, { kind: 'resolve', threadId: 'a', author: mira, at: 'x' });
    expect(before).toEqual(copy);
  });

  it('an action on a thread that is gone is NOT_FOUND with a plain message', () => {
    expect(() => applyOp(emptyCommentsFile(PAGE), { kind: 'reopen', threadId: 'zz' })).toThrow(/no longer exists/);
    try { applyOp(emptyCommentsFile(PAGE), { kind: 'delete', threadId: 'zz' }); } catch (e) { expect(e).toMatchObject({ code: 'NOT_FOUND' }); }
  });

  it('commit messages name the action and the page', () => {
    expect(commitMessage(add('a'), PAGE)).toBe('Comment on systems/inventory.md');
    expect(commitMessage({ kind: 'reply', threadId: 'a', id: 'r', body: '', author: mira, at: '' }, PAGE)).toBe('Reply to a comment on systems/inventory.md');
    expect(commitMessage({ kind: 'resolve', threadId: 'a', author: mira, at: '' }, PAGE)).toBe('Resolve a comment on systems/inventory.md');
    expect(commitMessage({ kind: 'reopen', threadId: 'a' }, PAGE)).toBe('Reopen a comment on systems/inventory.md');
    expect(commitMessage({ kind: 'delete', threadId: 'a' }, PAGE)).toBe('Delete a comment on systems/inventory.md');
  });
});

/** An in-memory store whose file another editor can change between a read and a write. */
function memoryStore(initial: CommentsFile | null = null) {
  let file = initial;
  let version = initial ? 1 : 0;
  const writes: CommentWriteOptions[] = [];
  let beforeWrite: (() => void) | null = null;
  const store: CommentStore = {
    id: 'memory',
    async read(page) { return { file: file ?? emptyCommentsFile(page), etag: file ? String(version) : null }; },
    async write(_page, next, opts) {
      beforeWrite?.();
      writes.push(opts);
      if ((file ? String(version) : null) !== opts.expectedEtag) throw new ContentError('CONFLICT', 'changed');
      file = next.threads.length ? next : null;
      version++;
      return { commitSha: `sha${version}`, commitUrl: null, etag: file ? String(version) : null };
    },
  };
  return {
    store, writes,
    get file() { return file; },
    otherEditor(change: (f: CommentsFile) => CommentsFile) { beforeWrite = () => { beforeWrite = null; file = change(file ?? emptyCommentsFile(PAGE)); version++; }; },
  };
}

describe('changeComments', () => {
  const author = { name: 'Mira Okonkwo', email: 'mira@example.com' };

  it('reads the latest file, applies the action and writes it with the etag it read', async () => {
    const m = memoryStore();
    const res = await changeComments(m.store, PAGE, add('a'), author);
    expect(res.file.threads.map((t) => t.id)).toEqual(['a']);
    expect(res.commitSha).toBe('sha1');
    expect(m.writes).toEqual([{ message: 'Comment on systems/inventory.md', author, expectedEtag: null }]);
  });

  it('when someone else changed the comments meanwhile, applies the action again on their version (both kept)', async () => {
    const m = memoryStore();
    m.otherEditor((f) => applyOp(f, add('theirs', 'Their comment')));
    const res = await changeComments(m.store, PAGE, add('mine', 'My comment'), author);
    expect(res.file.threads.map((t) => t.id)).toEqual(['theirs', 'mine']);
    expect(m.file!.threads.map((t) => t.id)).toEqual(['theirs', 'mine']);
    expect(m.writes).toHaveLength(2);
  });

  it('gives up after three conflicts with a message that says to try again', async () => {
    const store: CommentStore = { id: 'x', read: async (page) => ({ file: emptyCommentsFile(page), etag: null }), write: async () => { throw new ContentError('CONFLICT', 'changed'); } };
    await expect(changeComments(store, PAGE, add('a'), author)).rejects.toThrow(/changed the comments on this page at the same time/);
  });

  it('passes other errors through unchanged (a token that cannot write)', async () => {
    const err = new ContentError('FORBIDDEN', 'This token can read the repo but cannot write to it.');
    const store: CommentStore = { id: 'x', read: async (page) => ({ file: emptyCommentsFile(page), etag: null }), write: async () => { throw err; } };
    await expect(changeComments(store, PAGE, add('a'), author)).rejects.toBe(err);
  });
});
