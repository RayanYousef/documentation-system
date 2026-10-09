// The reader-side Edit button (a few hundred bytes). Hovering or focusing it starts fetching the editor
// chunk, so the click opens the editor sooner. `before` holds other page actions shown in the same row
// (the Comments button).
import React, { type ReactNode } from 'react';
import IconEdit from '@theme/Icon/Edit';
import styles from './styles.module.css';

export function EditButton({ onEdit, onPrefetch, before }: { onEdit(): void; onPrefetch?(): void; before?: ReactNode }) {
  return (
    <div className={styles.editRow}>
      {before}
      <button type="button" className={`button button--sm button--outline button--primary ${styles.editButton}`} data-testid="inplace-edit-button"
        onClick={onEdit} onMouseEnter={onPrefetch} onFocus={onPrefetch}>
        <IconEdit /> Edit
      </button>
    </div>
  );
}
