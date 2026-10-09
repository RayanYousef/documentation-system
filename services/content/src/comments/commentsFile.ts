// Where a page's comments file lives and what a valid one looks like. Shared by every CommentStore and by
// the site plugin that publishes the files into the build.
import { COMMENTS_SCHEMA, ContentError, commentsFileName, type CommentAuthor, type CommentEntry, type CommentThread, type CommentsFile } from '@platform/contracts';
import { assertPagePath } from '../layout.js';

/** Folder of the comment files, relative to the site folder (a sibling of docs/, outside the OKF bundle). */
export const COMMENTS_DIR = 'comments';

/** "systems/inventory.md" -> "comments/systems/inventory.json" (relative to the site folder). Throws VALIDATION for a bad page path. */
export function commentsFilePath(page: string): string {
  assertPagePath(page);
  return `${COMMENTS_DIR}/${commentsFileName(page)}`;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isAuthor = (v: unknown): v is CommentAuthor => !!v && typeof v === 'object' && isString((v as CommentAuthor).login) && isString((v as CommentAuthor).name);
const isEntry = (v: unknown): v is CommentEntry => {
  const e = v as CommentEntry;
  return !!e && typeof e === 'object' && isString(e.id) && e.id.length > 0 && isAuthor(e.author) && isString(e.createdAt) && isString(e.body);
};
const isThread = (v: unknown): v is CommentThread => {
  const t = v as CommentThread;
  if (!isEntry(t) || (t.status !== 'open' && t.status !== 'resolved') || !Array.isArray(t.replies) || !t.replies.every(isEntry)) return false;
  const a = t.anchor;
  if (!a || typeof a !== 'object' || !isString(a.exact) || !a.exact || !isString(a.prefix) || !isString(a.suffix)) return false;
  if (a.tab !== null && (typeof a.tab !== 'object' || typeof a.tab.group !== 'number' || !isString(a.tab.value) || !isString(a.tab.label))) return false;
  return true;
};

/** Throws VALIDATION unless `file` is a comments file for `page` with unique thread ids. */
export function assertCommentsFile(file: unknown, page: string): asserts file is CommentsFile {
  const f = file as CommentsFile;
  if (!f || typeof f !== 'object' || f.schema !== COMMENTS_SCHEMA) throw new ContentError('VALIDATION', `Not a comments file (schema ${COMMENTS_SCHEMA})`);
  if (f.page !== page) throw new ContentError('VALIDATION', `The comments file is for ${String(f.page)}, not ${page}`);
  if (!Array.isArray(f.threads) || !f.threads.every(isThread)) throw new ContentError('VALIDATION', `The comments file of ${page} has a malformed thread`);
  if (new Set(f.threads.map((t) => t.id)).size !== f.threads.length) throw new ContentError('VALIDATION', `The comments file of ${page} repeats a thread id`);
}

/** Parses and checks a stored comments file. */
export function parseCommentsFile(text: string, page: string): CommentsFile {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ContentError('VALIDATION', `The comments file of ${page} is not JSON`); }
  assertCommentsFile(data, page);
  return data;
}

/** The stored form: two-space JSON with a final newline (readable diffs in Git). */
export const serializeCommentsFile = (file: CommentsFile): string => `${JSON.stringify(file, null, 2)}\n`;

export const commentsConflict = (page: string): ContentError =>
  new ContentError('CONFLICT', `The comments on ${page} changed since they were loaded`);
