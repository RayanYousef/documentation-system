// The edit bar: sticky under the site navbar while a page is being edited.
// [Visual | Raw]  [Page settings]  [Page actions v]  ...  * Unsaved changes  [commit message]  [Cancel] [Save]
// status line (role=status)
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { EditingMode } from './composeDocument.js';
import type { Status } from './editSessionReducer.js';

export interface EditBarProps {
  mode: EditingMode;
  onMode(mode: EditingMode): void;
  /** null hides the toggle (folder intros have no settings panel). */
  settingsOpen: boolean | null;
  onToggleSettings(): void;
  actions: ReactNode;
  message: string;
  defaultMessage: string;
  onMessage(message: string): void;
  dirty: boolean;
  saving: boolean;
  /** Save is offered only while editing (not during a conflict). */
  canSave: boolean;
  onCancel(): void;
  onSave(): void;
  status: Status | null;
  /** Reports the bar's height, so the formatting toolbar can stick right below it. */
  onHeight?(px: number): void;
}

export function EditBar({ mode, onMode, settingsOpen, onToggleSettings, actions, message, defaultMessage, onMessage, dirty, saving, canSave, onCancel, onSave, status, onHeight }: EditBarProps) {
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !onHeight) return undefined;
    onHeight(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);
  return (
    <div ref={bar} className="ped-editbar ped-chrome" role="toolbar" aria-label="Edit page">
      <div className="ped-segmented" role="group" aria-label="Editing mode">
        <button type="button" aria-pressed={mode === 'visual'} disabled={saving} onClick={() => mode !== 'visual' && onMode('visual')}>Visual</button>
        <button type="button" aria-pressed={mode === 'raw'} disabled={saving} onClick={() => mode !== 'raw' && onMode('raw')}>Raw</button>
      </div>
      {settingsOpen !== null && (
        <button type="button" className="ped-btn ped-btn--secondary" aria-pressed={settingsOpen} aria-expanded={settingsOpen} disabled={mode === 'raw'} onClick={onToggleSettings}>Page settings</button>
      )}
      {actions}
      <span className="ped-spacer" />
      {dirty && <span className="ped-dirty">Unsaved changes</span>}
      <input className="ped-input ped-commit" aria-label="Commit message" placeholder={defaultMessage} value={message} disabled={saving} onChange={(e) => onMessage(e.target.value)} />
      <button type="button" className="ped-btn ped-btn--secondary" disabled={saving} onClick={onCancel}>Cancel</button>
      <button type="button" className="ped-btn" disabled={saving || !canSave} onClick={onSave}>{saving ? 'Saving...' : 'Save'}</button>
      {status && (
        <p className="ped-status" role="status" data-testid="edit-status" data-kind={status.kind}>
          {status.text}{status.url ? <>{' '}<a href={status.url} target="_blank" rel="noreferrer">View commit</a></> : null}
        </p>
      )}
    </div>
  );
}
