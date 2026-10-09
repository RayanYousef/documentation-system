// What the sign-in dialog asks for, per AuthProvider (keyed by AuthProvider.id). A new provider is a new
// entry here plus its wiring in the site composition root; the dialog itself does not change.
import type { ReactNode } from 'react';
import type { Credentials } from '@platform/contracts';
import type { InPlaceHost } from '../host.js';

export interface SignInPanel {
  /** One or two sentences: what to enter and why. */
  intro(host: Pick<InPlaceHost, 'config' | 'mode'>): ReactNode;
  /** Accessible name and placeholder of the one input. */
  label: string;
  placeholder: string;
  secret: boolean;
  toCredentials(value: string): Credentials;
  /** Text of the remember-me warning (what is stored on this device). */
  rememberWarning: string;
  /** A link shown under a sign-in error: where to read how to get a working credential. */
  help?(host: Pick<InPlaceHost, 'config'>): { label: string; href: string };
}

export const SIGN_IN_PANELS: Readonly<Record<string, SignInPanel>> = {
  'github-token': {
    intro: ({ config }) => (
      <>
        Paste a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained personal access token</a>{' '}
        scoped to <strong>{config.organizationName}/{config.projectName}</strong> with <strong>Contents: Read and write</strong>.
        Only write collaborators can sign in. Saves commit to <code>{config.deployBranch}</code>.
      </>
    ),
    label: 'GitHub token',
    placeholder: 'github_pat_...',
    secret: true,
    toCredentials: (token) => ({ kind: 'github-token', token }),
    help: ({ config }) => ({ label: 'Create your token', href: `${config.baseUrl}platform/editor#create-your-token` }),
    rememberWarning: 'Anyone using this browser profile can read the saved token and commit as you. Do not keep it on a shared machine; use Sign out in the page actions menu when done.',
  },
  mock: {
    intro: ({ mode }) => (mode === 'local-disk'
      ? <>Local editing: saves are written to the files in your working tree (no commit). Your name only appears in <code>log.md</code>.</>
      : <>Development sign-in: choose a display name.</>),
    label: 'Display name',
    placeholder: 'Your name',
    secret: false,
    toCredentials: (name) => ({ kind: 'mock', name, role: 'editor' }),
    rememberWarning: 'The name is kept in this browser until you sign out.',
  },
};
