// Opens the editor's sign-in dialog on its own (in a React root of its own, with the editor stylesheet), for
// sign-ins that do not start from Edit: a comment. Resolves with the new session, or null when cancelled.
import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Identity, Session } from '@platform/contracts';
import type { InPlaceHost } from '@platform/editor/inplace';
import { SignInDialog } from '@platform/editor/signin';
import { useEditorStylesheet } from './editorStylesheet';

export interface SignedIn { session: Session; identity: Identity; remember: boolean }

function Styled({ children }: { children: React.ReactNode }) {
  useEditorStylesheet();
  return <>{children}</>;
}

export function showSignInDialog(host: Pick<InPlaceHost, 'auth' | 'config' | 'mode'>, initialError?: string): Promise<SignedIn | null> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.setAttribute('data-platform-signin', '');
    document.body.appendChild(el);
    const root = createRoot(el);
    const done = (result: SignedIn | null) => {
      // Unmount after this event, not inside the dialog's own handler.
      setTimeout(() => { root.unmount(); el.remove(); }, 0);
      resolve(result);
    };
    root.render(
      <Styled>
        <SignInDialog host={host} initialError={initialError}
          onCancel={() => done(null)}
          onSignedIn={(session, identity, remember) => done({ session, identity, remember })} />
      </Styled>,
    );
  });
}
