// Open-comment counts per tab, published by the lazy comments layer and read by the site's Tabs wrapper
// (site/src/theme/Tabs), which shows them on the tab labels. A few hundred bytes in the reader bundle.
import { useSyncExternalStore } from 'react';

/** Per tab group (its `.tabs-container` element): tab value -> number of open comments. */
export type TabCommentCounts = ReadonlyMap<Element, Readonly<Record<string, number>>>;

const EMPTY: TabCommentCounts = new Map();
let counts: TabCommentCounts = EMPTY;
const listeners = new Set<() => void>();

export function setTabCommentCounts(next: TabCommentCounts): void {
  counts = next.size ? next : EMPTY;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** All counts (the same object until they change). */
export const useTabCommentCounts = (): TabCommentCounts => useSyncExternalStore(subscribe, () => counts, () => EMPTY);
