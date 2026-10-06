// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useViewerUrl, viewerSource, type ViewerSourceProps, type ViewerUrlServices } from './viewerUrl.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const defaultRef = (repo: string) => (repo === 'o/r' ? 'dev' : 'main');

describe('viewerSource', () => {
  it('prefixes a site-relative src with the base url and keeps other urls', () => {
    expect(viewerSource({ src: '/models/a.glb' }, '/Base/', defaultRef)).toEqual({ kind: 'url', url: '/Base/models/a.glb' });
    expect(viewerSource({ src: 'https://x.dev/a.glb' }, '/Base/', defaultRef)).toEqual({ kind: 'url', url: 'https://x.dev/a.glb' });
  });

  it('reads repo + path from the backend, with the ref or the repo default ref', () => {
    expect(viewerSource({ repo: 'o/r', path: 'a.fbx' }, '/', defaultRef)).toEqual({ kind: 'asset', ref: { repo: 'o/r', ref: 'dev', path: 'a.fbx' } });
    expect(viewerSource({ repo: 'o/r', gitRef: 'v1', path: 'a.fbx' }, '/', defaultRef)).toEqual({ kind: 'asset', ref: { repo: 'o/r', ref: 'v1', path: 'a.fbx' } });
  });

  it('has nothing to show without src or repo + path', () => {
    expect(viewerSource({}, '/', defaultRef)).toBeNull();
    expect(viewerSource({ repo: 'o/r' }, '/', defaultRef)).toBeNull();
  });
});

describe('useViewerUrl', () => {
  let root: Root;
  let host: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement('div');
    root = createRoot(host);
    URL.createObjectURL = vi.fn(() => 'blob:1');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

  function Probe({ p, s }: { p: ViewerSourceProps; s: ViewerUrlServices }) {
    return <span>{useViewerUrl(p, s) ?? 'none'}</span>;
  }
  const render = (p: ViewerSourceProps, s: ViewerUrlServices) => act(async () => root.render(<Probe p={p} s={s} />));
  const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('waits for typing to settle, then resolves once', async () => {
    const services = { baseUrl: '/B/', getAsset: vi.fn(async () => new Blob(['x'])), defaultRef };
    await render({ src: '/a' }, services);
    await render({ src: '/ab' }, { ...services });
    await tick(100);
    expect(host.textContent).toBe('none');
    await render({ src: '/abc' }, services);
    await tick(300);
    expect(host.textContent).toBe('/B/abc');
  });

  it('fetches repo assets as object urls and revokes them on change', async () => {
    const getAsset = vi.fn(async () => new Blob(['x']));
    await render({ repo: 'o/r', path: 'a.fbx' }, { baseUrl: '/', getAsset, defaultRef });
    await tick(300);
    expect(getAsset).toHaveBeenCalledWith({ repo: 'o/r', ref: 'dev', path: 'a.fbx' });
    expect(host.textContent).toBe('blob:1');
    await render({ repo: 'o/r', path: 'a.fbx' }, { baseUrl: '/', getAsset: vi.fn(async () => new Blob(['y'])), defaultRef });
    await tick(300);
    expect(getAsset).toHaveBeenCalledTimes(1);
    await render({ src: '/m.glb' }, { baseUrl: '/', getAsset, defaultRef });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });
});
