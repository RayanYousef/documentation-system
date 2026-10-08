// "Page actions" menu of the edit bar: page-level operations and sign out.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type PageAction = 'new' | 'rename' | 'delete' | 'publish' | 'sign-out';

export interface PageActionsMenuProps {
  /** Who is signed in (shown at the top of the menu). */
  who: string;
  canPageOps: boolean;
  canPublish: boolean;
  /** Folder intros cannot be renamed or deleted here (they hold the folder's generated index). */
  isIndex: boolean;
  disabled: boolean;
  onAction(action: PageAction): void;
}

export function PageActionsMenu({ who, canPageOps, canPublish, isIndex, disabled, onAction }: PageActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const item = (action: PageAction, label: string, enabled = true) => (
    <button type="button" role="menuitem" disabled={disabled || !enabled} onClick={() => { setOpen(false); onAction(action); }}>{label}</button>
  );
  return (
    <div className="ped-menu" ref={root}>
      <button type="button" className="ped-btn ped-btn--secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        Page actions <ChevronDown className="size-3.5" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Page actions" className="ped-menu-list">
          <div className="ped-menu-who">Signed in as {who}</div>
          {canPageOps && <>
            {item('new', 'New page in this folder...')}
            {item('rename', 'Rename...', !isIndex)}
            {item('delete', 'Delete...', !isIndex)}
          </>}
          {canPublish && item('publish', 'Publish version...')}
          <hr />
          {item('sign-out', 'Sign out')}
        </div>
      )}
    </div>
  );
}
