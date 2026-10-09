// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { AssetInfo, ContentBackend, Identity, MutationOptions, PlatformConfig } from '@platform/contracts';
import { createRichTextServices, type RichTextSession } from './createRichTextServices.js';
import { UnsupportedFileError } from './assets.js';
import { forgetLocalAssets, localAssetUrl } from './localAssets.js';

const identity: Identity = { name: 'Ray', login: 'ray', email: null } as Identity;
const config = { baseUrl: '/Base/', organizationName: 'o', projectName: 'r', deployBranch: 'main', sitePath: 'site', codeRepos: [{ owner: 'o', repo: 'r', defaultRef: 'dev' }] } as unknown as PlatformConfig;

function fakeBackend(over: Partial<ContentBackend> = {}) {
  const uploads: { path: string; bytes: Uint8Array; opts: MutationOptions }[] = [];
  const backend = {
    uploadAsset: vi.fn(async (path: string, bytes: Uint8Array, opts: MutationOptions) => {
      uploads.push({ path, bytes, opts });
      return { commitSha: 'c', commitUrl: null, etag: 'e', regenerated: [], asset: { path, url: `/${path}`, size: bytes.length, kind: 'image' } as AssetInfo };
    }),
    listAssets: vi.fn(async (): Promise<AssetInfo[]> => [{ path: 'models/a.glb', url: '/models/a.glb', size: 1, kind: 'model' }]),
    getAsset: vi.fn(async () => new Blob(['x'])),
    ...over,
  } as unknown as ContentBackend;
  return { backend, uploads };
}
const session = (backend: ContentBackend, id: Identity = identity): RichTextSession => ({ host: { config } as RichTextSession['host'], backend, identity: id });
const file = (name: string) => new File(['abc'], name);

describe('createRichTextServices', () => {
  it('uploads an image to uploads/<name> with the old message and author, and returns the based src', async () => {
    const { backend, uploads } = fakeBackend();
    const s = createRichTextServices(session(backend), 'guide/page.md');
    expect(s.baseUrl).toBe('/Base/');
    await expect(s.uploadImage(file('a b.png'))).resolves.toEqual({ src: '/Base/uploads/a-b.png', alt: 'a-b.png' });
    expect(uploads[0]!.path).toBe('uploads/a-b.png');
    expect(uploads[0]!.opts).toEqual({ message: 'Add image a-b.png for guide/page.md', author: { name: 'Ray', email: 'ray@users.noreply.github.com' } });
    expect(Array.from(uploads[0]!.bytes)).toEqual([97, 98, 99]);
  });

  it('uploads a model to models/ or models/fbx/ and returns a site-relative src', async () => {
    const { backend, uploads } = fakeBackend();
    const s = createRichTextServices(session(backend, { ...identity, email: 'ray@x.dev' }), 'p.md');
    await expect(s.uploadModel(file('ship.glb'))).resolves.toEqual({ component: 'ModelViewer', src: '/models/ship.glb', alt: 'ship.glb' });
    await expect(s.uploadModel(file('air.fbx'))).resolves.toEqual({ component: 'FbxViewer', src: '/models/fbx/air.fbx', alt: 'air.fbx' });
    expect(uploads.map((u) => u.path)).toEqual(['models/ship.glb', 'models/fbx/air.fbx']);
    expect(uploads[1]!.opts).toEqual({ message: 'Add 3D model air.fbx for p.md', author: { name: 'Ray', email: 'ray@x.dev' } });
  });

  it('remembers uploads so the new block renders before the site serves the file', async () => {
    const { backend } = fakeBackend();
    const s = createRichTextServices(session(backend), 'p.md');
    await s.uploadModel(file('ship.glb'));
    await s.uploadImage(file('pic.png'));
    expect(localAssetUrl('/models/ship.glb')).toMatch(/^blob:/);
    expect(localAssetUrl('/Base/uploads/pic.png')).toMatch(/^blob:/);
    forgetLocalAssets();
  });

  it('refuses unsupported files before uploading', async () => {
    const { backend } = fakeBackend();
    const s = createRichTextServices(session(backend), 'p.md');
    await expect(s.uploadImage(file('a.txt'))).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(s.uploadModel(file('a.obj'))).rejects.toThrow('Unsupported 3D model type ".obj". Use .glb, .gltf or .fbx.');
    expect(backend.uploadAsset).not.toHaveBeenCalled();
  });

  it('lists assets once and caches them', async () => {
    const { backend } = fakeBackend();
    const s = createRichTextServices(session(backend), 'p.md');
    const [a, b] = await Promise.all([s.listAssets(), s.listAssets()]);
    expect(a).toBe(b);
    await s.listAssets();
    expect(backend.listAssets).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed listing so the next call tries again', async () => {
    const listAssets = vi.fn<() => Promise<AssetInfo[]>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    const { backend } = fakeBackend({ listAssets });
    const s = createRichTextServices(session(backend), 'p.md');
    await expect(s.listAssets()).rejects.toThrow('offline');
    await expect(s.listAssets()).resolves.toEqual([]);
    expect(listAssets).toHaveBeenCalledTimes(2);
  });

  it('reads a file the deploy has not published yet from the deploy branch of the site repository', async () => {
    const { backend } = fakeBackend();
    const s = createRichTextServices(session(backend), 'p.md');
    await s.getSiteAsset!('/Base/uploads/pic.png');
    await s.getSiteAsset!('/models/ship.glb');
    expect(backend.getAsset).toHaveBeenNthCalledWith(1, { repo: 'o/r', ref: 'main', path: 'site/static/uploads/pic.png' });
    expect(backend.getAsset).toHaveBeenNthCalledWith(2, { repo: 'o/r', ref: 'main', path: 'site/static/models/ship.glb' });
    await expect(s.getSiteAsset!('https://example.com/a.png')).rejects.toThrow('not a file of this site');
  });

  it('passes asset reads through and resolves default refs from the code repos', async () => {
    const { backend } = fakeBackend();
    const s = createRichTextServices(session(backend), 'p.md');
    await s.getAsset({ repo: 'o/r', ref: 'main', path: 'a.fbx' });
    expect(backend.getAsset).toHaveBeenCalledWith({ repo: 'o/r', ref: 'main', path: 'a.fbx' });
    expect(s.defaultRef('o/r')).toBe('dev');
    expect(s.defaultRef('x/y')).toBe('main');
  });
});
