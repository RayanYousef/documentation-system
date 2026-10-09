// Where a viewer block loads its model from. No editor library here.
// - `src` that starts with "/" is site-relative: the site base url goes in front.
// - Otherwise `repo` + `path` (+ `ref`, else the repo's default ref) is read through the backend
//   and shown as an object url, which is revoked when it is no longer used.
import { useEffect, useRef, useState } from 'react';
import type { AssetRef } from '@platform/contracts';
import { localAssetUrl } from './localAssets.js';
import type { RichTextServices } from './RichTextEditor.js';

export interface ViewerSourceProps { src?: string; repo?: string; gitRef?: string; path?: string }
export type ViewerSource = { kind: 'url'; url: string } | { kind: 'asset'; ref: AssetRef } | null;
export type ViewerUrlServices = Pick<RichTextServices, 'baseUrl' | 'getAsset' | 'getSiteAsset' | 'defaultRef'>;

export function viewerSource({ src, repo, gitRef, path }: ViewerSourceProps, baseUrl: string, defaultRef: (repo: string) => string): ViewerSource {
  if (src) return { kind: 'url', url: localAssetUrl(src) ?? (src.startsWith('/') ? `${baseUrl}${src.slice(1)}` : src) };
  if (!repo || !path) return null;
  return { kind: 'asset', ref: { repo, ref: gitRef || defaultRef(repo), path } };
}

/**
 * The url to preview, or null. Resolves `delayMs` after the props stop changing, so typing in a prop
 * input does not fetch a model per keystroke. Only the prop values and the base url restart it:
 * a new services object (one per App render) does not refetch or rebuild the viewer.
 */
export function useViewerUrl({ src, repo, gitRef, path }: ViewerSourceProps, services: ViewerUrlServices | null, delayMs = 300): string | null {
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const baseUrl = services?.baseUrl ?? '/';
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const timer = setTimeout(() => {
      const s = servicesRef.current;
      const source = viewerSource({ src, repo, gitRef, path }, baseUrl, s?.defaultRef ?? (() => 'main'));
      if (source?.kind === 'url') {
        // A site file that the deploy has not published yet (an upload saved a moment ago, then a reload): read it from GitHub.
        if (!src || !s?.getSiteAsset || localAssetUrl(src) || !src.startsWith('/')) { setUrl(source.url); return; }
        const readFromGithub = () => s.getSiteAsset!(src).then(
          (blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); },
          () => { if (!cancelled) setUrl(source.url); },
        );
        fetch(source.url, { method: 'HEAD' }).then((res) => { if (cancelled) return; if (res.ok) setUrl(source.url); else return readFromGithub(); }, () => { if (!cancelled) setUrl(source.url); });
        return;
      }
      if (!source || !s) { setUrl(null); return; }
      s.getAsset(source.ref).then(
        (blob) => { if (cancelled) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); },
        () => { if (!cancelled) setUrl(null); },
      );
    }, delayMs);
    return () => { cancelled = true; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, repo, gitRef, path, baseUrl, delayMs]);
  return url;
}
