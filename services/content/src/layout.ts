import { ContentError, CURRENT_VERSION, type AssetInfo, type VersionId } from '@platform/contracts';

export function versionDir(version: VersionId): string {
  if (version === CURRENT_VERSION) return 'docs';
  if (!/^\w[\w.-]*$/.test(version) || version.includes('..')) throw new ContentError('VALIDATION', `Invalid version ${version}`);
  return `versioned_docs/version-${version}`;
}
export const isFrozen = (version: VersionId): boolean => version !== CURRENT_VERSION;
export const STATIC_DIR = 'static';
export const ASSET_DIRS = ['models', 'uploads', 'img'];
const MODEL_EXT = new Set(['glb', 'gltf', 'fbx']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
export function assetKind(path: string): AssetInfo['kind'] {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return MODEL_EXT.has(ext) ? 'model' : IMAGE_EXT.has(ext) ? 'image' : 'other';
}
export function assertPagePath(path: string): void {
  if (!/^(?:[\w.-]+\/)*[\w.-]+\.mdx?$/.test(path) || path.split('/').some((s) => s === '..' || s.startsWith('.'))) {
    throw new ContentError('VALIDATION', `Invalid page path: ${path}`);
  }
}
/** Asset paths are relative to the static folder: plain POSIX segments, no `..`, no dot-files, no backslashes or drive letters. */
export function assertAssetPath(path: string): void {
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(path) || path.split('/').some((s) => s === '..' || s.startsWith('.'))) {
    throw new ContentError('VALIDATION', `Invalid asset path ${path}`);
  }
}
