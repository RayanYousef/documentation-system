// While there are unsaved edits: in-site navigation asks first (the host's router guard) and the browser
// asks before the tab is closed or reloaded. Released as soon as the edits are saved or discarded.
import { useEffect, useRef } from 'react';
import type { NavigationGuard } from '../host.js';

export const DISCARD_PROMPT = 'You have unsaved changes. Discard them?';

/** `onDiscard`: the user confirmed leaving the page through an in-site link (the edits are thrown away). */
export function useUnsavedGuard(dirty: boolean, navigation: NavigationGuard, onDiscard?: () => void): void {
  const discard = useRef(onDiscard);
  discard.current = onDiscard;
  useEffect(() => {
    if (!dirty) return undefined;
    const release = navigation.block(DISCARD_PROMPT, () => discard.current?.());
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => { release(); window.removeEventListener('beforeunload', onBeforeUnload); };
  }, [dirty, navigation]);
}
