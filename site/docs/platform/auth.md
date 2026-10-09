---
title: Auth service
description: Explains how the GitHub token provider decides who may edit (repository push permission), how the mock provider serves tests, and where sessions live in the browser; open it when a login fails or when you need the provider behaviour a new AuthProvider has to match.
type: system
tags: [platform, auth, github, session, security]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/auth
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/auth/src/GithubTokenProvider.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/auth/src/MockAuthProvider.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/auth/test/GithubTokenProvider.test.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/session/SessionStore.ts
sidebar_position: 4
---

`@platform/auth` holds every `AuthProvider` implementation. It imports only `@platform/contracts` (and may import `@platform/okf-core`); it never imports the content service, the editor or the site.

## GithubTokenProvider

`new GithubTokenProvider({ owner, repo, fetch?, apiRoot? })`, id `github-token`.

- `login({ kind: 'github-token', token })` trims the token, builds `{ provider: 'github-token', token, createdAt }` and calls `verify`; any other `Credentials.kind` throws `UNSUPPORTED_CREDENTIALS`.
- `verify(session)` calls `GET /repos/{owner}/{repo}` with the token. 401, 403 and 404 become `AuthError('INVALID_CREDENTIALS')`; other failures `NETWORK`. It then requires `permissions.push === true`, otherwise `AuthError('NOT_COLLABORATOR', ...)` with a message that tells the user to ask for write access and create a fine-grained token with Contents: Read and write. Name, login and email come from `GET /user` (`email` may be null; the editor then sets the commit author email to `<login>@users.noreply.github.com`). Role is `editor` when push is true.
- `login` (not `verify`) then proves the token can write: one `POST /repos/{owner}/{repo}/git/blobs` with a tiny body, a blob no tree points to, which GitHub cleans up by itself and which needs the same permission as a save. 403 or 404 becomes `AuthError('CANNOT_WRITE', ...)` ("This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write."), 401 `INVALID_CREDENTIALS`, any other failure and a lost connection `NETWORK`. This is needed because for a fine-grained token `permissions.push` shows the user's role in the repository, not what the token may do. A remembered session is verified without the write, so reopening the editor costs no extra request. The sign-in dialog shows the message with a "Create your token" link to the [Editor service](editor.md#create-your-token) page.
- The fix this design introduced: the old editor only checked that the repository call succeeded, so any valid token passed the gate and failed at save time. The push check moves that failure to login.

Tests run the contract suite against a mocked `fetch` (`test/fakeGithubAuth.ts`) covering valid, invalid and non-collaborator cases, plus checks for the `NOT_COLLABORATOR` message, the `Bearer` and `X-GitHub-Api-Version` headers and the write check (a token that cannot write, exactly one blob POST, a lost connection during it, a 401, and that `verify` does not write). The `NETWORK` path is not covered by a test.

## MockAuthProvider

Id `mock`. `login({ kind: 'mock', name, role })` encodes the identity into the token (`mock.` followed by base64 JSON); `verify` decodes it. No network. Used by unit tests and by in-place editing on `npm start` (a display-name sign-in: nothing is committed there, the name only appears in `log.md`).

## Sessions

Session storage is the editor's concern, not the provider's. `BrowserSessionStore` (`services/editor/src/session/SessionStore.ts`) keeps the session in memory and writes it to `localStorage` under `docs-platform.session` when "Remember on this device" is ticked, which is the default in the sign-in dialog (it shows a shared-device warning; "Sign out" in the page actions menu forgets it). Dev sign-ins use the key `docs-platform.dev-session`. The sign-in dialog opens on the first Edit of a tab; its input comes from the panel registered for the provider's id in `services/editor/src/inplace/signInPanels.tsx`. The site reads the same key so `ModelViewer` and `FbxViewer` can fetch assets from private code repositories with the editor's token. A stored session is verified once per tab; one that fails is forgotten and the provider's message is shown in the sign-in dialog. A `NETWORK` failure (GitHub unreachable) keeps the session and only shows the reason.

## Phase 2

`PasswordProvider` (spec section 4.3) reads a users list (username, Argon2id hash, role) from an environment variable populated from a GitHub secret at deploy time, issues a JWT signed with a private key, publishes the public key at `/.well-known/docs-platform-jwks.json`, and validates signature and expiry in `verify`. It is a new file in this service and a new `Credentials` member; no existing provider changes. Steps in [Add an auth provider](extending/add-auth-provider.md).
