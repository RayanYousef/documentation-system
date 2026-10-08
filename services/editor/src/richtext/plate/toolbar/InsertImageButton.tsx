// Upload an image to the site's static/uploads and insert it as a Markdown image
// (port of mdx/toolbar/InsertImageButton.tsx: same path, src format, alt and alerts).
import { useRef, useState } from 'react';
import { useEditorRef } from 'platejs/react';
import { ImageUp } from 'lucide-react';
import { UnsupportedFileError } from '../../assets.js';
import { useRequiredServices } from '../context.js';
import { insertImage } from '../editor/transforms.js';
import { ToolbarButton } from '../ui/toolbar.js';

export function InsertImageButton() {
  const editor = useEditorRef();
  const services = useRequiredServices();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      insertImage(editor, await services.uploadImage(file));
      editor.tf.focus();
    } catch (e) {
      window.alert(e instanceof UnsupportedFileError ? e.message : `Could not upload image: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const title = busy ? 'Uploading image...' : 'Upload image';
  return (<>
    <ToolbarButton tooltip={title} aria-label={title} disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => input.current?.click()}>
      <ImageUp />
    </ToolbarButton>
    <input ref={input} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
  </>);
}
