// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ContentError, emptyCommentsFile, type CommentStore, type CommentThread, type CommentsFile } from '@platform/contracts';
import type { CommentEditor, CommentsHost } from '../host.js';
import type { PendingComments } from '../pending.js';
import { CommentsLayer } from './CommentsLayer.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PAGE = 'platform/comments.md';
const thread = (over: Partial<CommentThread> = {}): CommentThread => ({
  id: 'c1', body: 'This section here is horrible', author: { login: 'mira', name: 'Mira' }, createdAt: '2026-10-09T16:17:37.298Z',
  status: 'open', replies: [], anchor: { exact: 'text that is not on this test page', prefix: '', suffix: '', tab: null }, ...over,
});
const fileWith = (...threads: CommentThread[]): CommentsFile => ({ ...emptyCommentsFile(PAGE), threads });

/** A store holding one file; `file` can be changed by "someone else" between reads. */
function memoryStore(initial: CommentsFile) {
  const state = { file: initial, version: 1 };
  const store: CommentStore = {
    id: 'memory',
    read: vi.fn(async () => ({ file: state.file, etag: state.file.threads.length ? String(state.version) : null })),
    write: vi.fn(async (_page: string, next: CommentsFile, opts) => {
      if ((state.file.threads.length ? String(state.version) : null) !== opts.expectedEtag) throw new ContentError('CONFLICT', 'changed');
      state.file = next;
      state.version++;
      return { commitSha: `commit-${state.version}`, commitUrl: null, etag: String(state.version) };
    }),
  };
  return { store, state };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

interface HostOptions {
  published: Promise<CommentsFile> | CommentsFile;
  editor?: CommentEditor | null;
  session?: boolean;
  pending?: PendingComments | null;
}
function makeHost(o: HostOptions) {
  const host: CommentsHost = {
    loadPublished: vi.fn(async () => o.published),
    hasSession: () => o.session ?? !!o.editor,
    signIn: vi.fn(async () => o.editor ?? null),
    signedInEditor: vi.fn(async () => o.editor ?? null),
    pending: o.pending ?? null,
    buildSha: 'build-of-older-commit',
    setTabCounts: () => {},
  };
  return host;
}

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mount(host: CommentsHost): Promise<HTMLElement> {
  container = document.createElement('article');
  container.innerHTML = '<div class="theme-doc-markdown"><p>Size. Readers download the comments code as a lazy chunk.</p></div><div id="mount"></div>';
  document.body.appendChild(container);
  root = createRoot(container.querySelector('#mount')!);
  await act(async () => { root!.render(<CommentsLayer host={host} page={PAGE} />); });
  await settle();
  return container;
}
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
const label = () => document.querySelector('[data-testid="comments-button"]')!.getAttribute('aria-label');
const click = (el: Element | null | undefined) => act(async () => { (el as HTMLElement).click(); });
const buttonNamed = (scope: ParentNode, name: string) => [...scope.querySelectorAll('button')].find((b) => b.textContent === name);

describe('CommentsLayer: what the page shows', () => {
  it('a signed-in editor sees the store\'s current comments, not an older published file (the reported bug)', async () => {
    // The published file of the served build still has the comment open; on main it was resolved since.
    const { store } = memoryStore(fileWith(thread({ status: 'resolved', resolvedBy: { login: 'mira', name: 'Mira' }, resolvedAt: '2026-10-09T16:19:28.008Z' })));
    const host = makeHost({ published: fileWith(thread()), editor: { identity: { login: 'mira', name: 'Mira' } as CommentEditor['identity'], store } });
    await mount(host);
    expect(host.signedInEditor).toHaveBeenCalled();
    expect(label()).toBe('Comments'); // no open comment
    await click(document.querySelector('[data-testid="comments-button"]'));
    expect(document.querySelector('[data-testid="unattached-item"]')).toBeNull();
    await click(buttonNamed(document, 'Resolved 1'));
    expect(document.querySelectorAll('[data-testid="resolved-item"]')).toHaveLength(1);
  });

  it('a published answer that arrives after the store\'s never replaces it', async () => {
    const late = deferred<CommentsFile>();
    const { store } = memoryStore(emptyCommentsFile(PAGE)); // deleted on main
    const host = makeHost({ published: late.promise, editor: { identity: { login: 'mira', name: 'Mira' } as CommentEditor['identity'], store } });
    await mount(host);
    expect(label()).toBe('Comments');
    await act(async () => { late.resolve(fileWith(thread())); });
    await settle();
    expect(label()).toBe('Comments');
  });

  it('a reader who is not signed in gets the published file and the store is never asked', async () => {
    const host = makeHost({ published: fileWith(thread()), session: false });
    await mount(host);
    expect(label()).toBe('Comments (1 open)');
    expect(host.signedInEditor).not.toHaveBeenCalled();
  });

  it('when the store cannot be read, the published file stays shown', async () => {
    const store: CommentStore = { id: 'down', read: async () => { throw new ContentError('NETWORK', 'offline'); }, write: async () => { throw new Error('no'); } };
    const host = makeHost({ published: fileWith(thread()), editor: { identity: { login: 'mira', name: 'Mira' } as CommentEditor['identity'], store } });
    await mount(host);
    expect(label()).toBe('Comments (1 open)');
  });

  it('an action on a comment someone deleted meanwhile shows the store\'s comments and says so (no stale open comment)', async () => {
    const m = memoryStore(fileWith(thread()));
    const saved: unknown[] = [];
    const pending: PendingComments = { get: () => null, save: (...args) => { saved.push(args); } };
    const host = makeHost({ published: fileWith(thread()), editor: { identity: { login: 'mira', name: 'Mira' } as CommentEditor['identity'], store: m.store }, pending });
    await mount(host);
    expect(label()).toBe('Comments (1 open)');
    m.state.file = emptyCommentsFile(PAGE); // another editor deleted it
    m.state.version++;
    await click(document.querySelector('[data-testid="comments-button"]'));
    await click(buttonNamed(document.querySelector('[data-testid="unattached-item"]')!, 'Resolve'));
    await settle();
    expect(document.querySelector('[data-testid="comments-notice"]')?.textContent).toMatch(/no longer exists/);
    expect(label()).toBe('Comments');
    expect(document.querySelector('[data-testid="unattached-item"]')).toBeNull();
    expect(document.querySelector('.pc-error')).toBeNull();
    expect(saved.at(-1)).toEqual([PAGE, emptyCommentsFile(PAGE), '']); // a reload shows the same
  });

  it('a change is kept as pending with the commit it made (it ends when the site is built from that commit)', async () => {
    const m = memoryStore(fileWith(thread()));
    const saved: unknown[][] = [];
    const pending: PendingComments = { get: () => null, save: (...args) => { saved.push(args); } };
    const host = makeHost({ published: fileWith(thread()), editor: { identity: { login: 'mira', name: 'Mira' } as CommentEditor['identity'], store: m.store }, pending });
    await mount(host);
    await click(document.querySelector('[data-testid="comments-button"]'));
    await click(buttonNamed(document.querySelector('[data-testid="unattached-item"]')!, 'Resolve'));
    await settle();
    expect(label()).toBe('Comments');
    expect(saved).toHaveLength(1);
    expect(saved[0]![2]).toBe('commit-2');
    expect((saved[0]![1] as CommentsFile).threads[0]!.status).toBe('resolved');
  });
});
