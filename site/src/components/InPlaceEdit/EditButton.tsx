// The reader-side Edit button (a few hundred bytes). Hovering or focusing it starts fetching the editor
// chunk, so the click opens the editor sooner.
import React from 'react';
import IconEdit from '@theme/Icon/Edit';
import styles from './styles.module.css';

export function EditButton({ onEdit, onPrefetch }: { onEdit(): void; onPrefetch?(): void }) {
  return (
    <div className={styles.editRow}>
      <button type="button" className={`button button--sm button--outline button--primary ${styles.editButton}`} data-testid="inplace-edit-button"
        onClick={onEdit} onMouseEnter={onPrefetch} onFocus={onPrefetch}>
        <IconEdit /> Edit
      </button>
    </div>
  );
}
