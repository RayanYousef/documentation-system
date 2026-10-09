// Files uploaded from this tab, shown from the browser's copy until the site serves them. On the live
// site an upload is committed at once but reaches the public static files only after the next deploy;
// without this the new viewer or image would show "could not load" until then.
// Keys are the src as written in the page ("/models/ship.glb", "<baseUrl>uploads/x.png").

const urls = new Map<string, string>();

/** Remembers the uploaded file for `src`; returns the object URL (null where object URLs are unavailable). */
export function rememberLocalAsset(src: string, file: Blob): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const previous = urls.get(src);
  if (previous) URL.revokeObjectURL?.(previous);
  const url = URL.createObjectURL(file);
  urls.set(src, url);
  return url;
}

/** The browser copy of an upload from this tab, if any. */
export const localAssetUrl = (src: string | undefined): string | null => (src ? urls.get(src) ?? null : null);

/** Test hook. */
export function forgetLocalAssets(): void {
  for (const u of urls.values()) URL.revokeObjectURL?.(u);
  urls.clear();
}
