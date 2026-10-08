// Rename and delete confirmations for the page being edited (modals, so the backend error stays visible
// next to the action that failed).
import { useState } from 'react';
import { Modal } from '../components/Modal.js';

export function RenamePageDialog({ path, dirty, onRename, onClose }: { path: string; dirty: boolean; onRename(to: string): Promise<void>; onClose(): void }) {
  const [to, setTo] = useState(path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = /\.mdx?$/.test(to.trim()) && to.trim() !== path;
  const rename = async () => {
    setBusy(true); setError('');
    try { await onRename(to.trim()); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Rename page" onClose={busy ? undefined : onClose}>
      <p>Moves <code>{path}</code> to a new path in one commit; the folder indexes, manifest and change log are regenerated.{dirty ? ' Your unsaved edits are discarded.' : ''}</p>
      <label className="ped-row"><span>new path</span><input aria-label="New path" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      {error && <p className="ped-problems" role="alert">{error}</p>}
      <div className="ped-actions">
        <button className="ped-btn" disabled={busy || !valid} onClick={rename}>{busy ? 'Renaming...' : 'Rename'}</button>
        <button className="ped-btn ped-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}

export function DeletePageDialog({ path, dirty, onDelete, onClose }: { path: string; dirty: boolean; onDelete(): Promise<void>; onClose(): void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true); setError('');
    try { await onDelete(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Delete page" onClose={busy ? undefined : onClose}>
      <p>Deletes <code>{path}</code> and removes it from its folder index, the manifest and the change log in one commit.{dirty ? ' Your unsaved edits are discarded.' : ''}</p>
      {error && <p className="ped-problems" role="alert">{error}</p>}
      <div className="ped-actions">
        <button className="ped-btn ped-btn--danger" disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Delete page'}</button>
        <button className="ped-btn ped-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  );
}
