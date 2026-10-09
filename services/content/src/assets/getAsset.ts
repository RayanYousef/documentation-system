import { ContentError, type AssetRef } from '@platform/contracts';

export const MAX_ASSET_BYTES = 100 * 1024 * 1024;
const CACHE_NAME = 'docs-platform-assets';
const BRANCH_TTL_MS = 10 * 60 * 1000;

export function assetUrls(ref: AssetRef): { media: string; raw: string } {
  const [owner, repo] = ref.repo.split('/');
  const path = ref.path.split('/').map(encodeURIComponent).join('/');
  return {
    media: `https://media.githubusercontent.com/media/${owner}/${repo}/${ref.ref}/${path}`,
    raw: `https://raw.githubusercontent.com/${owner}/${repo}/${ref.ref}/${path}`,
  };
}

const isSha = (ref: string): boolean => /^[0-9a-f]{40}$/.test(ref);
const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1';

/** The response, or null on 403/404; other HTTP errors and network failures throw. */
async function get(f: typeof fetch, url: string, headers: Record<string, string>): Promise<Response | null> {
  let res: Response;
  try { res = await f(url, { headers }); } catch (e) { throw new ContentError('NETWORK', `Cannot reach ${url}: ${(e as Error).message}`); }
  if (res.ok) return res;
  if (res.status === 404 || res.status === 403) return null;
  throw new ContentError('NETWORK', `HTTP ${res.status} fetching ${url}`);
}

/** A small text body that starts like a Git LFS pointer file (checked on a clone, the response stays readable). */
async function isLfsPointer(res: Response): Promise<boolean> {
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > 1024) return false;
  const text = await res.clone().text().catch(() => '');
  return text.length < 1024 && text.startsWith(LFS_POINTER);
}

/** Fetch a file from a code repo at a ref; LFS-aware via the media endpoint; cached with the Cache API when available. */
export async function fetchAsset(ref: AssetRef, opts: { token?: string | null; fetch?: typeof fetch; cache?: CacheStorage | null } = {}): Promise<Blob> {
  const f = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const cacheStore = opts.cache === undefined ? (typeof caches !== 'undefined' ? caches : null) : opts.cache;
  const key = `https://asset.cache/${ref.repo}@${ref.ref}/${ref.path}`;
  const cache = cacheStore ? await cacheStore.open(CACHE_NAME) : null;
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const at = Number(hit.headers.get('x-cached-at') ?? 0);
      if (isSha(ref.ref) || Date.now() - at < BRANCH_TTL_MS) return hit.blob();
    }
  }
  const headers: Record<string, string> = opts.token ? { Authorization: `token ${opts.token}` } : {};
  const urls = assetUrls(ref);
  // raw first: it serves every ordinary file. Only a Git LFS pointer (or a refusal) sends us to the media
  // endpoint, which 404s for files that are not in LFS (a console error on every page that shows one).
  let res: Response | null = await get(f, urls.raw, headers);
  if (res && (await isLfsPointer(res))) res = await get(f, urls.media, headers);
  else if (!res) res = await get(f, urls.media, headers);
  if (!res || !res.ok) throw new ContentError('NOT_FOUND', `Asset not found: ${ref.repo}@${ref.ref}/${ref.path}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_ASSET_BYTES) throw new ContentError('TOO_LARGE', `Asset is ${len} bytes; the limit is ${MAX_ASSET_BYTES}`);
  const blob = await res.blob();
  if (blob.size > MAX_ASSET_BYTES) throw new ContentError('TOO_LARGE', `Asset is ${blob.size} bytes; the limit is ${MAX_ASSET_BYTES}`);
  if (cache) await cache.put(key, new Response(blob, { headers: { 'x-cached-at': String(Date.now()), 'content-type': blob.type || 'application/octet-stream' } }));
  return blob;
}
