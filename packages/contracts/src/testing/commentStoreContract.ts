import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COMMENTS_SCHEMA, type CommentStore, type CommentsFile, type CommentThread } from '../comments.js';

export interface CommentStoreHarness {
  /** A store over a repository (or folder) that has no comment files yet. */
  store: CommentStore;
  /** Text of a file relative to the site folder ("comments/systems/inventory.json"); null when absent. */
  readFile(relPath: string): Promise<string | null>;
  /** Changes the page's comments file behind the store's back (another editor saving), or removes it (null). */
  writeBehind(page: string, file: CommentsFile | null): Promise<void>;
  cleanup?: () => Promise<void>;
}

export interface CommentStoreContractOptions {
  /** false: writes record no commit (CommentWriteResult.commitSha is ''). */
  commits?: boolean;
}

const author = { name: 'Contract Tester', email: 'tester@example.com' };
const thread = (id: string, body: string): CommentThread => ({
  id, body, author: { login: 'tester', name: 'Contract Tester' }, createdAt: '2026-10-09T10:00:00.000Z', status: 'open', replies: [],
  anchor: { exact: 'stored', prefix: 'how items are ', suffix: ' and', tab: null },
});
const fileWith = (page: string, ...threads: CommentThread[]): CommentsFile => ({ schema: COMMENTS_SCHEMA, page, threads });
const PAGE = 'systems/inventory.md';

export function describeCommentStoreContract(name: string, factory: () => Promise<CommentStoreHarness>, options: CommentStoreContractOptions = {}): void {
  const commits = options.commits ?? true;
  describe(`CommentStore contract: ${name}`, () => {
    let h: CommentStoreHarness;
    beforeEach(async () => { h = await factory(); });
    afterEach(async () => { await h.cleanup?.(); });

    it('a page without comments reads as an empty file with etag null', async () => {
      const { file, etag } = await h.store.read(PAGE);
      expect(file).toEqual({ schema: COMMENTS_SCHEMA, page: PAGE, threads: [] });
      expect(etag).toBeNull();
    });

    it('writes one JSON file per page under comments/, without the page extension, and reads it back', async () => {
      const res = await h.store.write(PAGE, fileWith(PAGE, thread('c1', 'First')), { message: 'Comment', author, expectedEtag: null });
      if (commits) expect(res.commitSha).toMatch(/^[0-9a-f]{7,40}$/);
      else expect(res.commitSha).toBe('');
      expect(res.etag).toBeTruthy();
      const raw = await h.readFile('comments/systems/inventory.json');
      expect(JSON.parse(raw!)).toEqual(fileWith(PAGE, thread('c1', 'First')));
      expect(raw!.endsWith('\n')).toBe(true);
      const back = await h.store.read(PAGE);
      expect(back.file.threads.map((t) => t.body)).toEqual(['First']);
      expect(back.etag).toBe(res.etag);
    });

    it('refuses a write when the file changed since it was read (CONFLICT), and keeps the other change', async () => {
      const first = await h.store.write(PAGE, fileWith(PAGE, thread('c1', 'First')), { message: 'Comment', author, expectedEtag: null });
      await h.writeBehind(PAGE, fileWith(PAGE, thread('c1', 'First'), thread('c2', 'Someone else')));
      await expect(h.store.write(PAGE, fileWith(PAGE, thread('c1', 'Mine')), { message: 'Comment', author, expectedEtag: first.etag }))
        .rejects.toMatchObject({ code: 'CONFLICT' });
      expect((await h.store.read(PAGE)).file.threads.map((t) => t.body)).toEqual(['First', 'Someone else']);
    });

    it('refuses to create a file that someone else created meanwhile (expected etag null)', async () => {
      await h.writeBehind(PAGE, fileWith(PAGE, thread('c2', 'Someone else')));
      await expect(h.store.write(PAGE, fileWith(PAGE, thread('c1', 'Mine')), { message: 'Comment', author, expectedEtag: null }))
        .rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('a file with no threads left removes the comments file', async () => {
      const first = await h.store.write(PAGE, fileWith(PAGE, thread('c1', 'First')), { message: 'Comment', author, expectedEtag: null });
      const res = await h.store.write(PAGE, fileWith(PAGE), { message: 'Delete', author, expectedEtag: first.etag });
      expect(res.etag).toBeNull();
      expect(await h.readFile('comments/systems/inventory.json')).toBeNull();
      expect((await h.store.read(PAGE)).etag).toBeNull();
    });

    it('rejects paths outside the Latest docs and files that are not comment files (VALIDATION)', async () => {
      await expect(h.store.read('../secrets.md')).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(h.store.read('notes.txt')).rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(h.store.write(PAGE, { schema: COMMENTS_SCHEMA, page: 'other.md', threads: [] }, { message: 'x', author, expectedEtag: null }))
        .rejects.toMatchObject({ code: 'VALIDATION' });
      await expect(h.store.write(PAGE, { schema: COMMENTS_SCHEMA, page: PAGE, threads: [{ id: 'x' }] } as unknown as CommentsFile, { message: 'x', author, expectedEtag: null }))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });
}
