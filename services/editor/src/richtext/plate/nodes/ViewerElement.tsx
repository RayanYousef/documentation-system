// ModelViewer / FbxViewer block: the real 3D preview from @platform/viewers plus inputs for the
// props the components manifest lists. The viewers load lazily, so three.js is only fetched when a
// page shows a viewer. The preview uses height 480 when the node has none; that default is never written.
import { lazy, Suspense } from 'react';
import { PlateElement, type PlateElementProps, useReadOnly } from 'platejs/react';
import { Box } from 'lucide-react';
import { useViewerUrl } from '../../viewerUrl.js';
import { useDocsComponents, useDocsServices } from '../context.js';
import { descriptorFor } from '../markdown/componentRules.js';
import { DOCS_KEYS } from './keys.js';
import { PropFields, fieldsFor } from './PropFields.js';

let viewers: Promise<typeof import('@platform/viewers')> | null = null;
const loadViewers = () => (viewers ??= import('@platform/viewers'));
const ModelPreview = lazy(() => loadViewers().then((m) => ({ default: m.ModelViewerCore })));
const FbxPreview = lazy(() => loadViewers().then((m) => ({ default: m.FbxViewerCore })));

export const PREVIEW_HEIGHT = 480;

const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function ViewerElement(props: PlateElementProps) {
  const { element, children } = props;
  const readOnly = useReadOnly();
  const services = useDocsServices();
  const descriptor = descriptorFor(useDocsComponents(), element);
  const isFbx = element.type === DOCS_KEYS.fbxViewer;
  const tag = text(element.jsxName) ?? descriptor?.name ?? (isFbx ? 'FbxViewer' : 'ModelViewer');
  const url = useViewerUrl({ src: text(element.src), repo: text(element.repo), gitRef: text(element.gitRef), path: text(element.path) }, services);
  const height = typeof element.height === 'number' && element.height > 0 ? element.height : PREVIEW_HEIGHT;
  const box = 'flex items-center justify-center rounded-md border border-border p-4 text-center text-xs text-muted-foreground';
  return (
    <PlateElement {...props} className="my-3">
      <div contentEditable={false} data-docs-block={tag} className="rounded-lg border border-dashed border-brand/60 p-3 text-sm">
        <div className="mb-2 flex items-center gap-2 font-medium text-foreground select-none">
          <Box className="size-4 text-brand" />
          <code className="font-mono text-xs">{`<${tag} />`}</code>
        </div>
        {!readOnly && <PropFields element={element} props={fieldsFor(descriptor, element)} tag={tag} className="mb-2 grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-1" />}
        {url
          ? (
            <Suspense fallback={<div className={box} style={{ height }}>Loading preview...</div>}>
              {isFbx ? <FbxPreview src={url} height={height} /> : <ModelPreview src={url} alt={text(element.alt)} height={height} />}
            </Suspense>
          )
          : <div className={box}>Set src, or repo + path, to preview.</div>}
      </div>
      {children}
    </PlateElement>
  );
}
