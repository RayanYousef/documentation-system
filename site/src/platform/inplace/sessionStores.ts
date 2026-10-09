// One session store per storage and key for the whole tab: a sign-in made for a comment is the sign-in the
// editor sees (and the other way round), also when it is not remembered on the device. Small enough for the
// reader's comments chunk (no auth provider, no backend).
import { BrowserSessionStore, SESSION_STORAGE_KEY } from '@platform/editor/session';

/** Dev sign-ins (display names) are kept apart from the GitHub token the site uses for private assets. */
export const DEV_SESSION_KEY = 'docs-platform.dev-session';

export const defaultStorage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

const NO_STORAGE = {};
const stores = new WeakMap<object, Map<string, BrowserSessionStore>>();

export function sharedSessionStore(storage: Storage | null, key: string = SESSION_STORAGE_KEY): BrowserSessionStore {
  const slot = storage ?? NO_STORAGE;
  let byKey = stores.get(slot);
  if (!byKey) { byKey = new Map(); stores.set(slot, byKey); }
  let store = byKey.get(key);
  if (!store) { store = new BrowserSessionStore(storage, key); byKey.set(key, store); }
  return store;
}
