// Upload and insert rules for images and 3D models. No React and no editor library here,
// so every rich text editor shares the same paths, src formats and messages.
import type { AssetInfo } from '@platform/contracts';
import { fileExtension, sanitizeFileName } from '../mdx/uploadHelpers.js';

export const IMAGE_EXTENSIONS: readonly string[] = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
export const MODEL_EXTENSIONS: readonly string[] = ['glb', 'gltf', 'fbx'];

export type ViewerComponent = 'ModelViewer' | 'FbxViewer';

/** A file type the editor does not accept. The message is shown to the user as is. */
export class UnsupportedFileError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsupportedFileError'; }
}

/** uploads/<clean name>. Throws UnsupportedFileError for other types. */
export function imageUploadPath(fileName: string): { name: string; path: string } {
  if (!IMAGE_EXTENSIONS.includes(fileExtension(fileName))) throw new UnsupportedFileError('Unsupported image type.');
  const name = sanitizeFileName(fileName);
  return { name, path: `uploads/${name}` };
}

/** models/<clean name>, or models/fbx/<clean name> for .fbx. Throws UnsupportedFileError for other types. */
export function modelUploadPath(fileName: string): { name: string; path: string; component: ViewerComponent } {
  const ext = fileExtension(fileName);
  if (!MODEL_EXTENSIONS.includes(ext)) throw new UnsupportedFileError(`Unsupported 3D model type ".${ext}". Use .glb, .gltf or .fbx.`);
  const name = sanitizeFileName(fileName);
  const isFbx = ext === 'fbx';
  return { name, path: isFbx ? `models/fbx/${name}` : `models/${name}`, component: isFbx ? 'FbxViewer' : 'ModelViewer' };
}

/** What to insert for an asset picked from the repo. */
export type AssetInsert =
  | { kind: 'viewer'; component: ViewerComponent; src: string; alt: string }
  | { kind: 'image'; src: string; alt: string };

/** Models keep the site-relative url; images (and other files) get the base url, with the path as alt. */
export function repoAssetInsert(a: AssetInfo, baseUrl: string): AssetInsert {
  if (a.kind === 'model') return { kind: 'viewer', component: a.path.endsWith('.fbx') ? 'FbxViewer' : 'ModelViewer', src: a.url, alt: a.path.split('/').at(-1) ?? a.path };
  return { kind: 'image', src: `${baseUrl}${a.url.slice(1)}`, alt: a.path };
}

/**
 * Where the editor loads an image from to show it. A site-relative src ("/img/logo.png") is served under
 * the site's base url, as the built site does; a src that already has the base url (uploads) or is absolute stays.
 * Display only: the Markdown keeps the src as written.
 */
export function imagePreviewUrl(src: string, baseUrl: string): string {
  return src.startsWith('/') && !src.startsWith('//') && !src.startsWith(baseUrl) ? `${baseUrl}${src.slice(1)}` : src;
}
