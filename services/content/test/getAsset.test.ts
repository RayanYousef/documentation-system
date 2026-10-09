import { describe, it, expect } from 'vitest';
import { fetchAsset, assetUrls } from '../src/index.js';

const ref = { repo: 'RayanYousef/documentation-system', ref: 'main', path: 'examples/unity-project/Assets/Models/Airship.fbx' };

describe('fetchAsset', () => {
  it('builds media and raw URLs', () => {
    expect(assetUrls(ref).media).toBe('https://media.githubusercontent.com/media/RayanYousef/documentation-system/main/examples/unity-project/Assets/Models/Airship.fbx');
    expect(assetUrls(ref).raw).toBe('https://raw.githubusercontent.com/RayanYousef/documentation-system/main/examples/unity-project/Assets/Models/Airship.fbx');
  });
  it('reads raw first (no 404 for ordinary files) and sends the token header', async () => {
    const calls: { url: string; auth?: string }[] = [];
    const f: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, auth: (init?.headers as Record<string, string>)?.['Authorization'] });
      return new Response('bytes', { status: 200 });
    };
    const blob = await fetchAsset(ref, { fetch: f, token: 't0k', cache: null });
    expect(await blob.text()).toBe('bytes');
    expect(calls.map((c) => c.url.split('/')[2])).toEqual(['raw.githubusercontent.com']);
    expect(calls[0]?.auth).toBe('token t0k');
  });
  it('follows a Git LFS pointer to the media endpoint', async () => {
    const pointer = 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 12\n';
    const calls: string[] = [];
    const f: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url.split('/')[2]!);
      return url.includes('media.') ? new Response('real-bytes!!', { status: 200 }) : new Response(pointer, { status: 200 });
    };
    const blob = await fetchAsset(ref, { fetch: f, cache: null });
    expect(await blob.text()).toBe('real-bytes!!');
    expect(calls).toEqual(['raw.githubusercontent.com', 'media.githubusercontent.com']);
  });
  it('falls back to media when raw refuses (private LFS setups)', async () => {
    const f: typeof fetch = async (input) => (String(input).includes('raw.') ? new Response(null, { status: 404 }) : new Response('m', { status: 200 }));
    expect(await (await fetchAsset(ref, { fetch: f, cache: null })).text()).toBe('m');
  });
  it('throws NOT_FOUND when both sources 404', async () => {
    const f: typeof fetch = async () => new Response(null, { status: 404 });
    await expect(fetchAsset(ref, { fetch: f, cache: null })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
