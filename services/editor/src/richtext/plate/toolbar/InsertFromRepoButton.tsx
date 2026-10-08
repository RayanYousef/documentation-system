// Insert an asset already committed to the site, without uploading it again
// (port of mdx/toolbar/InsertFromRepoButton.tsx: same Modal, list and insert format).
// The Modal is portaled to <body>: inside the sticky, blurred toolbar a position:fixed overlay would be clipped.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorRef } from 'platejs/react';
import { FolderOpen } from 'lucide-react';
import type { AssetInfo } from '@platform/contracts';
import { Modal } from '../../../components/Modal.js';
import { repoAssetInsert } from '../../assets.js';
import { useDocsComponents, useRequiredServices } from '../context.js';
import { insertAsset } from '../editor/transforms.js';
import { ToolbarButton } from '../ui/toolbar.js';

const TITLE = 'Insert from repo (existing models and images)';

export function InsertFromRepoButton() {
  const editor = useEditorRef();
  const services = useRequiredServices();
  const manifest = useDocsComponents();
  const [assets, setAssets] = useState<AssetInfo[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const openPicker = async () => {
    setOpen(true); setError('');
    if (assets) return;
    try { setAssets(await services.listAssets()); } catch (e) { setError(`Could not list assets: ${(e as Error).message}`); }
  };
  const pick = (a: AssetInfo) => {
    insertAsset(editor, manifest, repoAssetInsert(a, services.baseUrl));
    setOpen(false);
    editor.tf.focus();
  };
  return (<>
    <ToolbarButton tooltip={TITLE} aria-label={TITLE} onMouseDown={(e) => e.preventDefault()} onClick={() => void openPicker()}>
      <FolderOpen />
    </ToolbarButton>
    {open && createPortal(
      <Modal title="Insert from repo" onClose={() => setOpen(false)}>
        {error ? <p className="problems" role="alert">{error}</p> : !assets ? <p>Loading...</p> : assets.length === 0 ? <p>No assets committed yet.</p> : <ul className="filelist">{assets.map((a) => <li key={a.path}><button onClick={() => pick(a)}>{a.kind}: {a.path}</button></li>)}</ul>}
        <button className="btn secondary" onClick={() => setOpen(false)}>Close</button>
      </Modal>,
      document.body,
    )}
  </>);
}
