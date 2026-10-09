import { COMMENTS_SCHEMA, emptyCommentsFile, type CommentAnchor, type CommentAuthor, type CommentEntry, type CommentThread, type CommentsFile } from '@platform/contracts';

const isString = (v: unknown): v is string => typeof v === 'string';
const okAuthor = (v: unknown): v is CommentAuthor => !!v && typeof v === 'object' && isString((v as CommentAuthor).login) && isString((v as CommentAuthor).name);
const okEntry = (v: unknown): v is CommentEntry => {
  const e = v as CommentEntry;
  return !!e && typeof e === 'object' && isString(e.id) && isString(e.body) && isString(e.createdAt) && okAuthor(e.author);
};
const okAnchor = (v: unknown): v is CommentAnchor => {
  const a = v as CommentAnchor;
  if (!a || typeof a !== 'object' || !isString(a.exact) || !a.exact || !isString(a.prefix) || !isString(a.suffix)) return false;
  const t = a.tab;
  return t === null || (!!t && typeof t === 'object' && typeof t.group === 'number' && isString(t.value) && isString(t.label));
};
const okThread = (v: unknown): v is CommentThread => {
  const t = v as CommentThread;
  return okEntry(t) && (t.status === 'open' || t.status === 'resolved') && okAnchor(t.anchor) && Array.isArray(t.replies)
    && (t.resolvedBy === undefined || okAuthor(t.resolvedBy)) && (t.resolvedAt === undefined || isString(t.resolvedAt));
};

/**
 * A published comments file as readers get it from the site. Files are checked when they are written and when
 * the build publishes them, so this only guards the page against a hand-edited or damaged file: a thread or
 * reply whose fields are not all of the right type is skipped (the page renders and anchors only well-formed
 * ones), anything else is an empty file.
 */
export function readPublishedComments(data: unknown, page: string): CommentsFile {
  const f = data as CommentsFile | null;
  if (!f || typeof f !== 'object' || f.schema !== COMMENTS_SCHEMA || !Array.isArray(f.threads)) return emptyCommentsFile(page);
  return { schema: COMMENTS_SCHEMA, page, threads: f.threads.filter(okThread).map((t) => ({ ...t, replies: t.replies.filter(okEntry) })) };
}
