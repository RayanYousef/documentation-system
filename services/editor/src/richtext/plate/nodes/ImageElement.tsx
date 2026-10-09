// Markdown image. The data follows Plate's default `img` Markdown rule: src in `url`, alt in `caption`.
// When editable, the block shows src and alt inputs. A site-relative src is shown from the site's base url.
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { TElement } from 'platejs';
import { PlateElement, type PlateElementProps, useEditorRef, useReadOnly } from 'platejs/react';
import { imagePreviewUrl } from '../../assets.js';
import { localAssetUrl } from '../../localAssets.js';
import { useDocsServices } from '../context.js';

/** Alt text of an image node (Plate keeps it as caption text). */
export const imageAlt = (element: TElement): string =>
  Array.isArray(element.caption) ? (element.caption as { text?: string }[]).map((c) => c.text ?? '').join('') : '';

const stop = (e: KeyboardEvent | MouseEvent) => e.stopPropagation();
const fieldClass = 'h-7 w-full min-w-0 rounded border border-input bg-field px-2 font-mono text-xs text-foreground';

export function ImageElement(props: PlateElementProps) {
  const { element } = props;
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const services = useDocsServices();
  const baseUrl = services?.baseUrl ?? '/';
  // An upload that was saved but not deployed yet: the site answers 404 for it (after a reload there is no browser copy),
  // so the picture is read from GitHub instead.
  const [fromGithub, setFromGithub] = useState<{ src: string; url: string } | null>(null);
  useEffect(() => () => { if (fromGithub) URL.revokeObjectURL?.(fromGithub.url); }, [fromGithub]);
  const url = typeof element.url === 'string' ? element.url : '';
  const alt = imageAlt(element);
  const shown = localAssetUrl(url) ?? (fromGithub?.src === url ? fromGithub.url : imagePreviewUrl(url, baseUrl));
  const readFromGithub = () => {
    if (!services?.getSiteAsset || localAssetUrl(url) || fromGithub?.src === url) return;
    void services.getSiteAsset(url).then((blob) => setFromGithub({ src: url, url: URL.createObjectURL(blob) }), () => { /* not on GitHub either: the broken image stays */ });
  };
  return (
    <PlateElement {...props} className="my-3">
      <div contentEditable={false}>
        {url
          ? <img src={shown} onError={readFromGithub} alt={alt} className="max-h-96 max-w-full rounded-md select-none" />
          : <span className="text-xs text-muted-foreground select-none">Image without src</span>}
        {!readOnly && (
          <div onKeyDown={stop} onMouseDown={stop} className="mt-1 grid grid-cols-[3rem_1fr] items-center gap-x-3 gap-y-1">
            <label className="contents">
              <span className="font-mono text-xs text-muted-foreground">src</span>
              <input aria-label="Image src" className={fieldClass} value={url} onChange={(e) => editor.tf.setNodes({ url: e.target.value } as Partial<TElement>, { at: element })} />
            </label>
            <label className="contents">
              <span className="font-mono text-xs text-muted-foreground">alt</span>
              <input aria-label="Image alt" className={fieldClass} value={alt} onChange={(e) => editor.tf.setNodes({ caption: [{ text: e.target.value }] } as Partial<TElement>, { at: element })} />
            </label>
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
