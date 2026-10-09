// The sign-in modal shown on the first Edit of a tab (no remembered session, or it stopped working).
// The input and its wording come from the panel registered for the host's AuthProvider.
import { useState, type FormEvent } from 'react';
import type { Identity, Session } from '@platform/contracts';
import type { InPlaceHost } from '../host.js';
import { Modal } from '../components/Modal.js';
import { SIGN_IN_PANELS } from './signInPanels.js';

export interface SignInDialogProps {
  host: Pick<InPlaceHost, 'auth' | 'config' | 'mode'>;
  /** Shown when the dialog opens (for example why a remembered session was forgotten). */
  initialError?: string;
  onSignedIn(session: Session, identity: Identity, remember: boolean): void;
  onCancel(): void;
}

export function SignInDialog({ host, initialError = '', onSignedIn, onCancel }: SignInDialogProps) {
  const panel = SIGN_IN_PANELS[host.auth.id];
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  if (!panel) {
    return (
      <Modal title="Sign in to edit" onClose={onCancel}>
        <p className="ped-problems" role="alert">No sign-in form is registered for the auth provider "{host.auth.id}".</p>
        <div className="ped-actions"><button type="button" className="ped-btn ped-btn--secondary" onClick={onCancel}>Close</button></div>
      </Modal>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const session = await host.auth.login(panel.toCredentials(value.trim()));
      const identity = await host.auth.verify(session);
      onSignedIn(session, identity, remember);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <Modal title="Sign in to edit" onClose={busy ? undefined : onCancel}>
      <p>{panel.intro(host)}</p>
      <form onSubmit={submit}>
        <input aria-label={panel.label} type={panel.secret ? 'password' : 'text'} placeholder={panel.placeholder} value={value} autoComplete="off" autoFocus
          onChange={(e) => setValue(e.target.value)} />
        <label className="ped-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember on this device
        </label>
        {remember && <div className="ped-notice">{panel.rememberWarning}</div>}
        {error && (
          <p className="ped-problems" role="alert">
            {error}{panel.help && <> <a href={panel.help(host).href} target="_blank" rel="noreferrer">{panel.help(host).label}</a></>}
          </p>
        )}
        <div className="ped-actions">
          <button className="ped-btn" type="submit" disabled={busy || !value.trim()}>{busy ? 'Verifying...' : 'Sign in'}</button>
          <button className="ped-btn ped-btn--secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
