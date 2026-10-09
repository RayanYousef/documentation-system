// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { ContentError, type AuthProvider, type ContentBackend, type Identity, type PageContent, type PlatformConfig, type Session, type WriteOptions } from '@platform/contracts';
import type { EditablePage, InPlaceHost, SessionStore } from '../host.js';
import { InPlaceEditor, type InPlaceExit } from './InPlaceEditor.js';
import { GENERATED_BLOCK_CHANGED } from './folderIntroGuard.js';
import { pendingEdits } from './pendingEdits.js';
import { drafts, forgetVerifiedSessions } from './useEditSession.js';
import { DISCARD_PROMPT } from './useUnsavedGuard.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@platform/viewers', () => ({ ModelViewerCore: () => <div />, FbxViewerCore: () => <div /> }));

beforeAll(() => {
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect ??= rect;
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
});

const RESOURCE = 'resource: https://github.com/o/r/blob/main/Assets/Inventory.cs';
const PAGE = `---\ntitle: Inventory\ndescription: Explains how items are stored.\ntype: system\n${RESOURCE}\n---\n\nItems stack.\n`;
const INDEX = '---\ntitle: Systems\n---\n\nIntro.\n\n<!-- okf:index -->\n## Pages\n* [Inventory](inventory.md) - Explains how items are stored.\n<!-- /okf:index -->\n';
const SESSION: Session = { provider: 'mock', token: 'mock.tok', createdAt: '2026-10-09T00:00:00Z' };
const IDENTITY: Identity = { name: 'Mira', login: 'mira', email: 'mira@example.com', role: 'editor' };

/** In-memory ContentBackend: etag = version counter, CONFLICT on a stale etag. */
function fakeBackend(files: Record<string, string>) {
  const versions: Record<string, number> = Object.fromEntries(Object.keys(files).map((k) => [k, 1]));
  const etag = (p: string) => `v${versions[p]}`;
  const backend = {
    id: 'fake',
    readPage: vi.fn(async (_v: string, path: string): Promise<PageContent> => {
      if (files[path] === undefined) throw new ContentError('NOT_FOUND', `No page at ${path}`);
      return { path, text: files[path]!, etag: etag(path) };
    }),
    writePage: vi.fn(async (_v: string, path: string, text: string, opts: WriteOptions) => {
      if (opts.expectedEtag && opts.expectedEtag !== etag(path)) throw new ContentError('CONFLICT', `${path} changed since you loaded it`);
      files[path] = text; versions[path]! += 1;
      return { commitSha: 'abcdef1234567890', commitUrl: 'https://github.com/o/r/commit/abcdef1234567890', etag: etag(path), regenerated: ['manifest.json', 'log.md'] };
    }),
    createPage: vi.fn(async () => ({ commitSha: 'c1', commitUrl: null, etag: 'e', regenerated: [] })),
    renamePage: vi.fn(async () => ({ commitSha: 'c2', commitUrl: null, etag: 'e', regenerated: [] })),
    deletePage: vi.fn(async () => ({ commitSha: 'c3', commitUrl: null, etag: '', regenerated: [] })),
    publishVersion: vi.fn(async (v: string) => ({ version: v, tag: `docs-v${v}`, commitSha: 'c4c4c4c4', pins: {} })),
    listVersions: vi.fn(async () => [{ id: 'current', label: 'Latest', frozen: false }, { id: '1.0.0', label: '1.0.0', frozen: true }]),
    listPages: vi.fn(async () => [{ path: 'systems/inventory.md', title: 'Inventory', description: '', type: 'system', tags: [] }]),
    listAssets: vi.fn(async () => []),
    getAsset: vi.fn(async () => new Blob()),
    uploadAsset: vi.fn(),
    search: vi.fn(async () => []),
    /** Simulates another commit to a page. */
    bump(path: string, text: string) { files[path] = text; versions[path]! += 1; },
  };
  return backend;
}

function makeHost(backend: ReturnType<typeof fakeBackend>, over: Partial<InPlaceHost> = {}, auth?: Partial<AuthProvider>) {
  let stored: Session | null = null;
  const sessionStore: SessionStore & { stored(): Session | null; preset(s: Session | null): void } = {
    load: vi.fn(() => stored), save: vi.fn((s: Session) => { stored = s; }), clear: vi.fn(() => { stored = null; }),
    stored: () => stored, preset: (s) => { stored = s; },
  };
  const releases: ReturnType<typeof vi.fn>[] = [];
  const navigation = { block: vi.fn(() => { const r = vi.fn(); releases.push(r); return r; }) };
  const host: InPlaceHost = {
    auth: { id: 'mock', login: vi.fn(async () => SESSION), verify: vi.fn(async () => IDENTITY), ...auth },
    backend: () => backend as unknown as ContentBackend,
    config: { baseUrl: '/b/', organizationName: 'o', projectName: 'r', deployBranch: 'main', codeRepos: [{ owner: 'o', repo: 'r', defaultRef: 'main', label: 'r' }] } as unknown as PlatformConfig,
    componentsUrl: 'http://localhost/none.json',
    mode: 'github',
    capabilities: { publish: true, pageOps: true },
    sessionStore,
    navigation,
    urls: { pageUrl: (p) => `/b/${p.replace(/(index)?\.mdx?$/, '')}`, commitUrl: (s) => `https://github.com/o/r/commit/${s}` },
    buildSha: 'build-1',
    navigate: vi.fn(),
    onSignedIn: vi.fn(),
    ...over,
  };
  return { host, sessionStore, navigation, releases };
}

const roots: Root[] = [];
let container: HTMLElement;
async function mount(host: InPlaceHost, page: EditablePage) {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const onExit = vi.fn<(r: InPlaceExit) => void>();
  await act(async () => root.render(<InPlaceEditor host={host} page={page} onExit={onExit} />));
  await settle();
  return { onExit, root };
}
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const inventory: EditablePage = { version: 'current', path: 'systems/inventory.md', title: 'Inventory', isIndex: false };
const systems: EditablePage = { version: 'current', path: 'systems/index.md', title: 'Systems', isIndex: true };
const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel) ?? document.body.querySelector<T>(sel);
const byLabel = (label: string) => q<HTMLInputElement>(`[aria-label="${label}"]`)!;
const button = (text: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const click = async (el: HTMLElement) => { await act(async () => { el.click(); }); await settle(); };
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
const rawView = () => EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;
async function typeRaw(text: string) {
  await act(async () => { const v = rawView(); v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text }, userEvent: 'input.type' }); });
}

beforeEach(() => { forgetVerifiedSessions(); drafts.clear(); sessionStorage.clear(); });
afterEach(async () => { for (const r of roots.splice(0)) await act(async () => r.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('InPlaceEditor: sign-in', () => {
  it('first Edit without a session shows the sign-in dialog; signing in remembers by default and loads the page', async () => {
    const backend = fakeBackend({ 'systems/inventory.md': PAGE });
    const { host, sessionStore } = makeHost(backend);
    await mount(host, inventory);
    expect(q('[role="dialog"]')!.textContent).toContain('Sign in to edit');
    await type(byLabel('Display name'), 'Mira');
    await click(button('Sign in'));
    expect(sessionStore.save).toHaveBeenCalledWith(SESSION, true);
    expect(host.onSignedIn).toHaveBeenCalled();
    expect(backend.readPage).toHaveBeenCalledWith('current', 'systems/inventory.md');
    expect(byLabel('Page title').value).toBe('Inventory');
    expect(q('[data-platform-editing]')).not.toBeNull();
  });

  it('a remembered session skips the dialog and is verified once per tab', async () => {
    const backend = fakeBackend({ 'systems/inventory.md': PAGE });
    const { host, sessionStore } = makeHost(backend);
    sessionStore.preset(SESSION);
    await mount(host, inventory);
    expect(q('[role="dialog"]')).toBeNull();
    expect(byLabel('Page title').value).toBe('Inventory');
    await mount(host, inventory);
    expect(host.auth.verify).toHaveBeenCalledTimes(1);
  });

  it('a remembered session that fails verification is forgotten and the dialog says why', async () => {
    const backend = fakeBackend({ 'systems/inventory.md': PAGE });
    const { host, sessionStore } = makeHost(backend, {}, { verify: vi.fn(async () => { throw new Error('Token expired.'); }) });
    sessionStore.preset(SESSION);
    await mount(host, inventory);
    expect(sessionStore.clear).toHaveBeenCalled();
    expect(q('[role="dialog"] [role="alert"]')!.textContent).toContain('no longer valid and was forgotten. Token expired.');
  });

  it('Cancel in the sign-in dialog leaves edit mode', async () => {
    const { host } = makeHost(fakeBackend({ 'systems/inventory.md': PAGE }));
    const { onExit } = await mount(host, inventory);
    await click(button('Cancel'));
    expect(onExit).toHaveBeenCalledWith({});
  });
});

describe('InPlaceEditor: editing and saving', () => {
  async function signedIn(files: Record<string, string>, page: EditablePage = inventory, over: Partial<InPlaceHost> = {}) {
    const backend = fakeBackend(files);
    const h = makeHost(backend, over);
    h.sessionStore.preset(SESSION);
    const m = await mount(h.host, page);
    return { backend, ...h, ...m };
  }

  it('saves the composed page with the loaded etag and the commit message, and hands the saved text back', async () => {
    const { backend, onExit, host } = await signedIn({ 'systems/inventory.md': PAGE });
    await type(byLabel('Page title'), 'Inventory and stacks');
    expect(q('.ped-dirty')).not.toBeNull();
    await type(byLabel('Commit message'), 'Rename the inventory page');
    await click(button('Save'));
    const expected = PAGE.replace('title: Inventory\n', 'title: Inventory and stacks\n');
    expect(backend.writePage).toHaveBeenCalledWith('current', 'systems/inventory.md', expected, { message: 'Rename the inventory page', author: { name: 'Mira', email: 'mira@example.com' }, expectedEtag: 'v1' });
    expect(onExit).toHaveBeenCalledWith({ saved: { text: expected, commitSha: 'abcdef1234567890', commitUrl: 'https://github.com/o/r/commit/abcdef1234567890', regenerated: ['manifest.json', 'log.md'] } });
    expect(pendingEdits.get('systems/inventory.md', host.buildSha)).toMatchObject({ text: expected, commitSha: 'abcdef1234567890' });
  });

  it('uses "Update <title>" when no commit message is given', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    await type(byLabel('Page title'), 'Inventory 2');
    await click(button('Save'));
    expect(backend.writePage.mock.calls[0]![3].message).toBe('Update Inventory');
  });

  it('keeps no pending edit after a dev (local-disk) save', async () => {
    const { host } = await signedIn({ 'systems/inventory.md': PAGE }, inventory, { mode: 'local-disk' });
    await type(byLabel('Page title'), 'Inventory 2');
    await click(button('Save'));
    expect(pendingEdits.get('systems/inventory.md', host.buildSha)).toBeNull();
  });

  it('a CONFLICT shows the conflict state; nothing is overwritten; Reload latest loads the new version', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    await type(byLabel('Page title'), 'Mine');
    backend.bump('systems/inventory.md', PAGE.replace('Items stack.', 'Items stack. Theirs.'));
    await click(button('Save'));
    expect(q('.ped-conflict')!.textContent).toContain('Someone else changed this page');
    expect(button('Copy my version (Raw)')).toBeTruthy();
    expect((button('Save') as HTMLButtonElement).disabled).toBe(true);
    await click(button('Reload latest'));
    expect(q('.ped-conflict')).toBeNull();
    expect(byLabel('Page title').value).toBe('Inventory');
    expect(container.textContent).toContain('Items stack. Theirs.');
  });

  it('Copy my version (Raw) shows my version in Raw', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    await type(byLabel('Page title'), 'Mine');
    backend.bump('systems/inventory.md', PAGE);
    await click(button('Save'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true });
    await click(button('Copy my version (Raw)'));
    expect(rawView().state.doc.toString()).toContain('title: Mine');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('title: Mine'));
  });

  it('shows validation problems instead of saving', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    await click(button('Page settings'));
    await type(byLabel('description') ?? q<HTMLInputElement>('.ped-frontmatter input[placeholder^="One sentence"]')!, '');
    await click(button('Save'));
    expect(backend.writePage).not.toHaveBeenCalled();
    expect(q('.ped-problems')!.textContent).toContain('missing "description"');
  });

  it('shows the backend VALIDATION details', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    backend.writePage.mockRejectedValueOnce(new ContentError('VALIDATION', 'Bundle has 1 problem(s) after this change', [{ file: 'systems/index.md', rule: 'link', message: 'broken link -> x.md' }]));
    await type(byLabel('Page title'), 'X');
    await click(button('Save'));
    expect(q('.ped-problems')!.textContent).toContain('broken link -> x.md');
    expect(q('[data-testid="edit-status"]')!.textContent).toContain('Bundle has 1 problem(s)');
  });

  it('Cancel when clean exits silently; when dirty it asks and stays on No', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onExit } = await signedIn({ 'systems/inventory.md': PAGE });
    await type(byLabel('Page title'), 'Changed');
    await click(button('Cancel'));
    expect(confirm).toHaveBeenCalledWith(DISCARD_PROMPT);
    expect(onExit).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await click(button('Cancel'));
    expect(onExit).toHaveBeenCalledWith({});
  });

  it('clean Cancel does not ask', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { onExit } = await signedIn({ 'systems/inventory.md': PAGE });
    await click(button('Cancel'));
    expect(confirm).not.toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledWith({});
  });

  it('blocks navigation while dirty and releases it after saving', async () => {
    const { navigation, releases } = await signedIn({ 'systems/inventory.md': PAGE });
    expect(navigation.block).not.toHaveBeenCalled();
    await type(byLabel('Page title'), 'Changed');
    expect(navigation.block).toHaveBeenCalledWith(DISCARD_PROMPT, expect.any(Function));
    await click(button('Save'));
    expect(releases[0]).toHaveBeenCalled();
  });

  it('Visual -> Raw shows the whole file; edits there are saved', async () => {
    const { backend } = await signedIn({ 'systems/inventory.md': PAGE });
    await click(button('Raw'));
    expect(rawView().state.doc.toString()).toBe(PAGE);
    await typeRaw(PAGE.replace('Items stack.', 'Items stack in raw.'));
    await click(button('Visual'));
    expect(container.querySelector('[data-slate-editor]')!.textContent).toContain('Items stack in raw.');
    await click(button('Save'));
    expect(backend.writePage.mock.calls[0]![2]).toBe(PAGE.replace('Items stack.', 'Items stack in raw.'));
  });

  it('a page the visual editor cannot import opens in Raw with the reason', async () => {
    await signedIn({ 'systems/inventory.md': PAGE.replace('Items stack.', 'import X from "y";\n\nItems stack.') });
    expect(container.querySelector('.cm-editor')).not.toBeNull();
    expect(q('[data-testid="edit-status"]')!.textContent).toContain('could not be opened in the visual editor');
  });

  it('leaving the page with "discard" confirmed keeps no draft for the next Edit', async () => {
    const backend = fakeBackend({ 'systems/inventory.md': PAGE });
    const h = makeHost(backend);
    h.sessionStore.preset(SESSION);
    const first = await mount(h.host, inventory);
    await type(byLabel('Page title'), 'Draft title');
    // The host's router asked "Discard them?" and the user said yes: the guard reports the leave, then the page unmounts.
    const onLeave = (h.navigation.block.mock.calls.at(-1) as unknown as [string, () => void])[1];
    await act(async () => onLeave());
    await act(async () => first.root.unmount());
    roots.splice(roots.indexOf(first.root), 1);
    await mount(h.host, inventory);
    expect(byLabel('Page title').value).toBe('Inventory');
    expect(q('[data-testid="edit-status"]')?.textContent ?? '').not.toContain('Restored your unsaved edits');
  });

  it('restores an unsaved draft after a remount', async () => {
    const backend = fakeBackend({ 'systems/inventory.md': PAGE });
    const h = makeHost(backend);
    h.sessionStore.preset(SESSION);
    const first = await mount(h.host, inventory);
    await type(byLabel('Page title'), 'Draft title');
    await act(async () => first.root.unmount());
    roots.splice(roots.indexOf(first.root), 1);
    await mount(h.host, inventory);
    expect(byLabel('Page title').value).toBe('Draft title');
    expect(q('[data-testid="edit-status"]')!.textContent).toContain('Restored your unsaved edits');
  });
});

describe('InPlaceEditor: folder intros', () => {
  it('shows the inline title but no Page settings; refuses a changed generated block', async () => {
    const backend = fakeBackend({ 'systems/index.md': INDEX });
    const h = makeHost(backend);
    h.sessionStore.preset(SESSION);
    await mount(h.host, systems);
    expect(byLabel('Page title').value).toBe('Systems');
    expect(button('Page settings')).toBeUndefined();
    expect(q('[data-testid="okf-generated"]')).not.toBeNull();
    await click(button('Raw'));
    await typeRaw(INDEX.replace('- Explains how items are stored.', '- Edited by hand.'));
    await click(button('Save'));
    expect(backend.writePage).not.toHaveBeenCalled();
    expect(q('[data-testid="edit-status"]')!.textContent).toBe(GENERATED_BLOCK_CHANGED);
  });

  it('saves an intro change with "Update <path> intro"', async () => {
    const backend = fakeBackend({ 'systems/index.md': INDEX });
    const h = makeHost(backend);
    h.sessionStore.preset(SESSION);
    await mount(h.host, systems);
    await type(byLabel('Page title'), 'Game systems');
    await click(button('Save'));
    expect(backend.writePage).toHaveBeenCalledWith('current', 'systems/index.md', INDEX.replace('title: Systems', 'title: Game systems'), expect.objectContaining({ message: 'Update systems/index.md intro' }));
  });
});

describe('InPlaceEditor: page actions', () => {
  async function withMenu(over: Partial<InPlaceHost> = {}, files: Record<string, string> = { 'systems/inventory.md': PAGE }) {
    const backend = fakeBackend(files);
    const h = makeHost(backend, over);
    h.sessionStore.preset(SESSION);
    const m = await mount(h.host, inventory);
    await click(button('Page actions'));
    return { backend, ...h, ...m };
  }
  const menuItems = () => [...document.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);

  it('lists the page operations, publish (github, editor role) and sign out', async () => {
    await withMenu();
    expect(menuItems()).toEqual(['New page in this folder...', 'Rename...', 'Delete...', 'Publish version...', 'Sign out']);
  });

  it('hides Publish version in local-disk mode', async () => {
    await withMenu({ mode: 'local-disk', capabilities: { publish: false, pageOps: true } });
    expect(menuItems()).not.toContain('Publish version...');
  });

  it('New page prefills the folder and creates the page', async () => {
    const { backend } = await withMenu();
    await click(button('New page in this folder...'));
    expect(byLabel('New page path').value).toBe('systems/');
    await type(byLabel('New page path'), 'systems/status.md');
    await type(byLabel('New page title'), 'Status');
    await type(byLabel('New page description'), 'Explains status effects.');
    await click(button('Create'));
    expect(backend.createPage).toHaveBeenCalledWith('current', 'systems/status.md', expect.stringContaining('title: Status'), expect.objectContaining({ message: 'Add systems/status.md' }));
    expect(q('[data-testid="edit-status"]')!.textContent).toContain('after the deploy');
  });

  it('Rename asks for the new path and renames', async () => {
    const { backend, onExit } = await withMenu();
    await click(button('Rename...'));
    await type(byLabel('New path'), 'systems/items.md');
    await click(button('Rename'));
    expect(backend.renamePage).toHaveBeenCalledWith('current', 'systems/inventory.md', 'systems/items.md', expect.objectContaining({ message: 'Rename systems/inventory.md to systems/items.md' }));
    expect(onExit.mock.calls[0]![0].notice).toContain('Renamed to systems/items.md');
  });

  it('Delete confirms, deletes and goes to the folder page', async () => {
    const { backend, host, onExit } = await withMenu();
    await click(button('Delete...'));
    await click(button('Delete page'));
    expect(backend.deletePage).toHaveBeenCalledWith('current', 'systems/inventory.md', expect.objectContaining({ message: 'Delete systems/inventory.md' }));
    expect(onExit).toHaveBeenCalled();
    expect(host.navigate).toHaveBeenCalledWith('/b/systems/');
  });

  it('Publish version publishes', async () => {
    const { backend } = await withMenu();
    await click(button('Publish version...'));
    await type(byLabel('Version'), '1.1.0');
    await click(button('Publish'));
    expect(backend.publishVersion).toHaveBeenCalledWith('1.1.0', expect.objectContaining({ message: 'Publish docs 1.1.0' }));
    expect(q('[data-testid="edit-status"]')!.textContent).toContain('Published 1.1.0');
  });

  it('Sign out forgets the session and leaves edit mode', async () => {
    const { sessionStore, onExit } = await withMenu();
    await click(button('Sign out'));
    expect(sessionStore.clear).toHaveBeenCalled();
    expect(sessionStore.stored()).toBeNull();
    expect(onExit).toHaveBeenCalledWith({ notice: 'Signed out.' });
  });
});
