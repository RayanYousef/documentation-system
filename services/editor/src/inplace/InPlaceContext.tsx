import { createContext, useContext } from 'react';
import type { ContentBackend, Identity, Session } from '@platform/contracts';
import type { InPlaceHost } from '../host.js';

/** The signed-in editing session, shared by the edit bar, dialogs and the body editor. */
export interface InPlaceSession {
  host: InPlaceHost;
  session: Session;
  identity: Identity;
  backend: ContentBackend;
  signOut(): void;
}

export const InPlaceContext = createContext<InPlaceSession | null>(null);

export function useInPlace(): InPlaceSession {
  const v = useContext(InPlaceContext);
  if (!v) throw new Error('useInPlace outside InPlaceContext');
  return v;
}
