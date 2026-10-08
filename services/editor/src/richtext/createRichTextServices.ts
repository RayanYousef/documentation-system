// Builds the platform services a rich text editor needs from the signed-in session.
// Editors get these as props and never call usePlatform() themselves.
import type { AssetInfo } from '@platform/contracts';
import type { PlatformSession } from '../PlatformContext.js';
import { readFileBytes } from '../mdx/uploadHelpers.js';
import { imageUploadPath, modelUploadPath } from './assets.js';
import type { RichTextServices } from './RichTextEditor.js';

/** The parts of the session the services use. Memoize on these (the session object itself changes every App render). */
export type RichTextSession = Pick<PlatformSession, 'platform' | 'backend' | 'identity'>;

export function createRichTextServices({ platform, backend, identity }: RichTextSession, fileLabel: string): RichTextServices {
  const { baseUrl, codeRepos } = platform.config;
  const author = { name: identity.name, email: identity.email ?? `${identity.login}@users.noreply.github.com` };
  let assets: Promise<AssetInfo[]> | null = null;
  return {
    baseUrl,
    async uploadImage(file) {
      const { name, path } = imageUploadPath(file.name);
      const res = await backend.uploadAsset(path, await readFileBytes(file), { message: `Add image ${name} for ${fileLabel}`, author });
      return { src: `${baseUrl}${res.asset.url.slice(1)}`, alt: name };
    },
    async uploadModel(file) {
      const { name, path, component } = modelUploadPath(file.name);
      await backend.uploadAsset(path, await readFileBytes(file), { message: `Add 3D model ${name} for ${fileLabel}`, author });
      return { component, src: `/${path}`, alt: name };
    },
    listAssets() {
      assets ??= backend.listAssets().catch((e: unknown) => { assets = null; throw e; });
      return assets;
    },
    getAsset: (ref) => backend.getAsset(ref),
    defaultRef: (repo) => codeRepos.find((c) => `${c.owner}/${c.repo}` === repo)?.defaultRef ?? 'main',
  };
}
