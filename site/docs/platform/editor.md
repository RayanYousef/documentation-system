---
title: Editor service
description: "Describes the in-browser editor (Vite + React + MDXEditor): how it is composed from platform.config.js, what each screen and dialog does, how frontmatter edits preserve YAML, how the arcade theme is applied, and how it is built and deployed under /editor/; open it when changing editor behaviour or debugging a save from the UI."
type: system
tags: [platform, editor, vite, react, mdxeditor, frontmatter, theme]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/composition/createPlatform.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/App.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/components/FrontmatterForm.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/frontmatter/yamlDoc.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/mdx/descriptors.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/mdx/componentsManifest.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/session/SessionStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme/index.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme/tokens.css
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/vite.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/editor.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/theme.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/scripts/copy-editor.mjs
sidebar_position: 6
---

`@platform/editor` is a standalone React application built with Vite. It talks to the platform only through `AuthProvider` and `ContentBackend`; the concrete classes are chosen in one file.

## Composition

`src/composition/createPlatform.ts` reads `platform.config.js` and returns `{ auth, backend(session), config, componentsUrl }`:

- `auth` is `MockAuthProvider` when `VITE_PLATFORM_AUTH=mock` or `auth.provider` is `mock`, otherwise `GithubTokenProvider({ owner: organizationName, repo: projectName })`.
- `backend(session)` is `HttpContentBackend(url)` when `VITE_PLATFORM_CONTENT` is set or `content.backend` is `http`, otherwise `GithubBrowserBackend` for `organizationName/projectName` on `deployBranch` under `sitePath`, with the session token.
- `componentsUrl` is `<baseUrl>platform/components.json`, produced by the site prebuild from `site/components.json`; a bundled default is used when the fetch fails.

This folder is the `editor-composition` lint element, the only part of the editor allowed to import `@platform/auth` and `@platform/content`. `PlatformContext.tsx` hands the result to the component tree.

## Screens and actions

- `LoginGate`: token (or mock name and role) input, "remember on this device" with a shared-device warning, provider errors shown inline; a stored session is re-verified on load and forgotten if verification fails.
- `FilePicker`: pages of the selected version. `index.md`, `log.md`, `AGENTS.md`, `README.md` and `code-maps/` are hidden; a folder's intro is edited through `FolderIntroEditor`, which only touches text before the generated markers (`src/mdx/folderIntro.ts`).
- `FrontmatterForm`: `title`, `description` (placeholder: "One sentence: when should someone open this page?"), `type` (dropdown of values in use plus a free-text new type), `tags` (comma-separated), `resource`, `sidebar_position`. Edits go through the `yaml` package's document API (`src/frontmatter/yamlDoc.ts`) so untouched lines, comments, quoting and scalar types survive; this fixes the numeric-quoting bug of the previous editor.
- `BodyEditor`: `@mdxeditor/editor` with the ported toolbar (undo/redo, marks, headings and quote, lists, links, image URL and upload, 3D model upload, insert-from-repo, tabs, table, rule, CodeMirror code block, admonitions) and a raw-MDX fallback. JSX descriptors for `ModelViewer`, `FbxViewer`, `Tabs` and `TabItem` are generated from `components.json`; previews come from `@platform/viewers`; descriptors emit no import lines because the site registers the components globally.
- Save: `validatePage` runs locally and `ProblemList` shows problems; the backend's `VALIDATION` details are shown the same way. Dirty tracking guards page and version switches, rename, create, logout and page unload.
- `NewPageDialog` (default `resource` built from the first `codeRepos` entry), Rename, Delete, and `PublishDialog` (role `editor`, version label input). Frozen versions open read-only.

## Theme

The look of the editor lives in one module, `src/theme/`, imported once from `src/main.tsx` as `./theme/index.js`:

- `tokens.css`: the arcade palette as `--ed-*` variables. Dark is the default (`index.html` sets `data-theme="dark"`); light applies when `html` has `data-theme="light"`, or when no `data-theme` is set and the OS prefers light. Every colour in the theme goes through these tokens.
- `arcade.css`: styles the app chrome (including the Visual/Raw segmented control) and remaps the MDXEditor tokens, popups and dialogs onto the `--ed-*` tokens.
- `codeMirror.ts`: gives code blocks a theme through the same tokens. It is wrapped in `Prec.highest` because MDXEditor appends its own light theme.
- `index.ts`: imports both CSS files and exports `EDITOR_THEME_CLASS` (`arcade-theme`) and `arcadeCodeMirror`.

`BodyEditor` passes `EDITOR_THEME_CLASS` as the MDXEditor `className` and `arcadeCodeMirror` as the CodeMirror extensions. MDXEditor puts the class on its root and on the portal container its popups and dialogs render into, which is why those are themed too. A new look is a sibling module imported from `main.tsx` in place of `./theme/index.js`; nothing else changes.

## Build and deploy

`vite.config.ts` sets `base` to `<baseUrl>editor/` from `platform.config.js`. `npm run build -w @platform/editor` type-checks and builds `services/editor/dist`; `scripts/copy-editor.mjs` copies it into `site/build/editor/` so GitHub Pages serves the editor at `https://RayanYousef.github.io/documentation-system/editor/`. The site navbar links there when `features.editor` is true.

Development: `npm run dev -w @platform/editor` with `VITE_PLATFORM_AUTH=mock` and `VITE_PLATFORM_CONTENT=http://127.0.0.1:4321` against `node services/editor/e2e/content-server.mjs` (a `serveContentBackend` over a `LocalFolderBackend`).

## Tests

Vitest component tests (`src/components/dialogs.test.tsx`, `yamlDoc.test.ts`, `folderIntro.test.ts`, `componentsManifest.test.ts`, `SessionStore.test.ts`) and two Playwright specs, both run with `npm run e2e -w @platform/editor`:

- `e2e/editor.spec.ts` logs in with the mock provider, edits, creates, renames, deletes and publishes version `1.1.0` against a temporary git repository, then asserts on the commits, the regenerated files, the sha-pinned frozen copy and the `docs-v1.1.0` tag.
- `e2e/theme.spec.ts` logs in with the mock provider, opens `systems/combat.md` and checks that the Block type select, the Admonition dropdown and the Insert image dialog use the dark `--ed-raised` surface and text colour instead of the MDXEditor default white.

## Known minor issues

- Rename and Delete use native `window.prompt` and `window.confirm` dialogs rather than the shared `Modal`.
- The frontmatter form has no field for `sources`; they are edited in the raw-MDX view.
- The New page dialog derives its default `resource` from `codeRepos[0]` only; other declared repositories must be typed by hand.
- Component insertion falls back to the bundled component list silently when `components.json` cannot be fetched.
- The Phase 1 HTTP bridge (`serveContentBackend`) has no authentication, which is why it is limited to local development and the e2e until the Phase 2 server exists.
