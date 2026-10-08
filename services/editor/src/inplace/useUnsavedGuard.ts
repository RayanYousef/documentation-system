// While there are unsaved edits: in-site navigation asks first (the host's router guard) and the browser
// asks before the tab is closed or reloaded. Released as soon as the edits are saved or discarded.
import { useEffect } from 'react';
import type { NavigationGuard } from '../host.js';

export const DISCARD_PROMPT = 'You have unsaved changes. Discard them?';

export function useUnsavedGuard(dirty: boolean, navigation: NavigationGuard): void {
  useEffect(() => {
    if (!dirty) return undefined;
    const release = navigation.block(DISCARD_PROMPT);
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { release(); window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [dirty, navigation]);
}
