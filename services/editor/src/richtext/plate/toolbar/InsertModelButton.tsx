// Upload a .glb/.gltf/.fbx to the site's static/models and insert the matching viewer
// (port of mdx/toolbar/InsertModelButton.tsx: same paths, src format, alt and alerts).
import { useRef, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import { Box } from 'lucide-react';
import { UnsupportedFileError } from '../../assets.js';
import { useDocsComponents, useRequiredServices } from '../context.js';
import { insertViewer } from '../editor/transforms.js';
import { ToolbarButton } from '../ui/toolbar.js';

export function InsertModelButton() {
  const editor = useEditorRef();
  const services = useRequiredServices();
  const manifest = useDocsComponents();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      insertViewer(editor, manifest, await services.uploadModel(file));
      editor.tf.focus();
    } catch (e) {
      window.alert(e instanceof UnsupportedFileError ? e.message : `Could not insert 3D model: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const title = busy ? 'Uploading model...' : 'Insert 3D model (.glb, .gltf, .fbx)';
  return (<>
    <ToolbarButton tooltip={title} aria-label={title} disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => input.current?.click()}>
      <Box />
    </ToolbarButton>
    <input ref={input} type="file" accept=".glb,.gltf,.fbx" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
  </>);
}
