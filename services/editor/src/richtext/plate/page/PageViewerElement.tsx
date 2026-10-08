// "Page look" ModelViewer / FbxViewer block: the real viewer (@platform/viewers) at the page's height,
// like readers see it, with a gear button that opens the props (src, repo, path, height, ...) in a
// popover. The viewers load lazily, so three.js is fetched only when a page shows one.
import { lazy, Suspense } from 'react';
import { PlateElement, useReadOnly, type PlateElementProps } from 'platejs/react';
import { Settings2 } from 'lucide-react';
import { useViewerUrl } from '../../viewerUrl.js';
import { useDocsComponents, useDocsServices } from '../context.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from '../nodes/keys.js';
import { PropFields, fieldsFor } from '../nodes/PropFields.js';
import { PREVIEW_HEIGHT } from '../nodes/ViewerElement.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';

let viewers: Promise<typeof import('@platform/viewers')> | null = null;
const loadViewers = () => (viewers ??= import('@platform/viewers'));
const ModelPreview = lazy(() => loadViewers().then((m) => ({ default: m.ModelViewerCore })));
const FbxPreview = lazy(() => loadViewers().then((m) => ({ default: m.FbxViewerCore })));

const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function PageViewerElement(props: PlateElementProps) {
  const { element, children } = props;
  const readOnly = useReadOnly();
  const services = useDocsServices();
  const descriptor = descriptorFor(useDocsComponents(), element);
  const isFbx = element.type === DOCS_KEYS.fbxViewer;
  const tag = text(element.jsxName) ?? descriptor?.name ?? (isFbx ? 'FbxViewer' : 'ModelViewer');
  const url = useViewerUrl({ src: text(element.src), repo: text(element.repo), gitRef: text(element.gitRef), path: text(element.path) }, services);
  const height = typeof element.height === 'number' && element.height > 0 ? element.height : PREVIEW_HEIGHT;
  return (
    <PlateElement {...props} className="ped-viewer">
      <div contentEditable={false} data-docs-block={tag} className="relative select-none">
        {url
          ? (
            <Suspense fallback={<div className="ped-viewer-box" style={{ height }}>Loading 3D viewer...</div>}>
              {isFbx ? <FbxPreview src={url} height={height} /> : <ModelPreview src={url} alt={text(element.alt)} height={height} />}
            </Suspense>
          )
          : <div className="ped-viewer-box" style={{ height }}>{`<${tag} />`}: set src, or repo + path, to preview.</div>}
        {!readOnly && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="ped-chip absolute top-2 right-2" aria-label={`${tag} settings`} onMouseDown={(e) => e.stopPropagation()}>
                <Settings2 className="size-3.5" /> {tag}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="ped-ui w-80" aria-label={`${tag} props`}>
              <PropFields element={element} props={fieldsFor(descriptor, element)} tag={tag} />
            </PopoverContent>
          </Popover>
        )}
      </div>
      {children}
    </PlateElement>
  );
}
