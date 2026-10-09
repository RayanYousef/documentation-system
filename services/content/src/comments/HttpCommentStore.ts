import { ContentError, type CommentStore, type CommentWriteOptions, type CommentWriteResult, type CommentsFile, type ContentErrorCode } from '@platform/contracts';

/** Methods of the comments RPC (`POST <baseUrl>/comments` with `{method, args}`). */
export type CommentMethod = 'read' | 'write';
export const COMMENT_METHODS: readonly CommentMethod[] = ['read', 'write'];

/** Client for a CommentStore served by createCommentRpcHandler (the dev server's disk endpoint). */
export class HttpCommentStore implements CommentStore {
  readonly id = 'http-comments';
  constructor(private readonly baseUrl: string, private readonly f: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  private async call<T>(method: CommentMethod, args: unknown[]): Promise<T> {
    let res: Response;
    try { res = await this.f(`${this.baseUrl.replace(/\/$/, '')}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) }); }
    catch (e) { throw new ContentError('NETWORK', `Comments service unreachable: ${(e as Error).message}`); }
    let data: { result?: T; error?: { code: ContentErrorCode; message: string; details?: unknown } };
    try { data = (await res.json()) as typeof data; } catch { throw new ContentError('NETWORK', `Comments service answered HTTP ${res.status}`); }
    if (data.error) throw new ContentError(data.error.code, data.error.message, data.error.details);
    return data.result as T;
  }

  read(page: string): Promise<{ file: CommentsFile; etag: string | null }> { return this.call('read', [page]); }
  write(page: string, file: CommentsFile, opts: CommentWriteOptions): Promise<CommentWriteResult> { return this.call('write', [page, file, opts]); }
}
