import { describe, it, expect } from 'vitest';
import type { AssetInfo } from '@platform/contracts';
import { IMAGE_EXTENSIONS, MODEL_EXTENSIONS, UnsupportedFileError, imagePreviewUrl, imageUploadPath, modelUploadPath, repoAssetInsert, siteAssetPath } from './assets.js';

const asset = (path: string, kind: AssetInfo['kind']): AssetInfo => ({ path, url: `/${path}`, size: 1, kind });

describe('assets', () => {
  it('allows the same file types as before', () => {
    expect(IMAGE_EXTENSIONS).toEqual(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
    expect(MODEL_EXTENSIONS).toEqual(['glb', 'gltf', 'fbx']);
  });

  it('puts images under uploads/ with a cleaned name', () => {
    expect(imageUploadPath('My Shot (1).PNG')).toEqual({ name: 'My-Shot-1.PNG', path: 'uploads/My-Shot-1.PNG' });
  });

  it('rejects other image types with the old message', () => {
    expect(() => imageUploadPath('notes.txt')).toThrow(UnsupportedFileError);
    expect(() => imageUploadPath('notes.txt')).toThrow('Unsupported image type.');
  });

  it('puts glb/gltf under models/ and fbx under models/fbx/', () => {
    expect(modelUploadPath('Ship 2.glb')).toEqual({ name: 'Ship-2.glb', path: 'models/Ship-2.glb', component: 'ModelViewer' });
    expect(modelUploadPath('cube.gltf')).toEqual({ name: 'cube.gltf', path: 'models/cube.gltf', component: 'ModelViewer' });
    expect(modelUploadPath('Air.FBX')).toEqual({ name: 'Air.FBX', path: 'models/fbx/Air.FBX', component: 'FbxViewer' });
  });

  it('rejects other model types with the old message', () => {
    expect(() => modelUploadPath('a.obj')).toThrow(new UnsupportedFileError('Unsupported 3D model type ".obj". Use .glb, .gltf or .fbx.'));
  });

  it('inserts a repo model as a viewer with the site-relative url and the file name as alt', () => {
    expect(repoAssetInsert(asset('models/fbx/Air.fbx', 'model'), '/Base/')).toEqual({ kind: 'viewer', component: 'FbxViewer', src: '/models/fbx/Air.fbx', alt: 'Air.fbx' });
    expect(repoAssetInsert(asset('models/cube.gltf', 'model'), '/Base/')).toEqual({ kind: 'viewer', component: 'ModelViewer', src: '/models/cube.gltf', alt: 'cube.gltf' });
  });

  it('inserts a repo image (and any other file) as an image with the base url and the path as alt', () => {
    expect(repoAssetInsert(asset('uploads/x.png', 'image'), '/Base/')).toEqual({ kind: 'image', src: '/Base/uploads/x.png', alt: 'uploads/x.png' });
    expect(repoAssetInsert(asset('uploads/notes.pdf', 'other'), '/Base/')).toEqual({ kind: 'image', src: '/Base/uploads/notes.pdf', alt: 'uploads/notes.pdf' });
  });

  it('maps a site address to the file under static/ (for reading a file the deploy has not published yet)', () => {
    expect(siteAssetPath('/Docs/uploads/a.png', '/Docs/')).toBe('uploads/a.png');
    expect(siteAssetPath('/models/fbx/Air.fbx', '/Docs/')).toBe('models/fbx/Air.fbx');
    expect(siteAssetPath('https://example.com/a.png', '/Docs/')).toBeNull();
    expect(siteAssetPath('//cdn.example.com/a.png', '/Docs/')).toBeNull();
    expect(siteAssetPath('pic.png', '/Docs/')).toBeNull();
    expect(siteAssetPath('/Docs/../secret', '/Docs/')).toBeNull();
  });

  it('shows site-relative images under the base url, and leaves uploads and absolute urls alone', () => {
    expect(imagePreviewUrl('/img/logo.png', '/Docs/')).toBe('/Docs/img/logo.png');
    expect(imagePreviewUrl('/Docs/uploads/a.png', '/Docs/')).toBe('/Docs/uploads/a.png');
    expect(imagePreviewUrl('https://example.com/a.png', '/Docs/')).toBe('https://example.com/a.png');
    expect(imagePreviewUrl('//cdn.example.com/a.png', '/Docs/')).toBe('//cdn.example.com/a.png');
    expect(imagePreviewUrl('pic.png', '/Docs/')).toBe('pic.png');
  });
});
