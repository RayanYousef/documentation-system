---
title: Editor service
description: "Describes in-place editing of the docs pages (Edit button, lazily loaded editor library, sign-in, Visual and Raw modes, page settings, page actions, saving to GitHub or to disk on the dev server, pending previews), how the editor library is composed by the site, how Markdown is imported and written back, how the page look and the isolated stylesheet work, and how it is tested; open it when changing editing behaviour or debugging a save."
type: system
tags: [platform, editor, inplace, react, plate, codemirror, markdown, tailwind, frontmatter, theme]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/host.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/index.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/InPlaceEditor.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/editSessionReducer.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/composeDocument.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/signInPanels.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/pendingEdits.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/SavedPreview.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/inplace/folderIntroGuard.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/frontmatter/yamlDoc.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/mdx/componentsManifest.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/rawtext/RawTextEditor.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/RichTextEditor.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/skin.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/createRichTextServices.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/localAssets.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/assets.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/PlateDocument.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/docsMarkdown.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/supportedSyntax.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/componentRules.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/nodes/docsNodesKit.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/kits/page-look-kit.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/kits/page-editor-kit.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/toolbar/FixedToolbarButtons.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/slash/SlashInputElement.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/session/SessionStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme-inpage/inplace.pcss
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/components.json
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/platform/inplace/createInPlaceHost.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/platform/inplace/mountInPlaceEditor.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/theme/DocItem/Content/index.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/plugins/platform-inplace-edit/index.mjs
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/plugins/platform-inplace-edit/devContentMiddleware.mjs
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/playwright.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/e2e/support.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/github/apiErrors.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/playwright.dev.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/playwright.live.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/e2e/live/live-save.spec.ts
sidebar_position: 6
---

Pages are edited where they are read. Every Latest page of the docs site has an **Edit** button above its content (and the footer's "Edit this page" does the same); the page turns into an editor in the same content column, with the same navbar, sidebar, table of contents and colour mode. `@platform/editor` is a React library: the site loads it only when someone clicks Edit, and it talks to the platform only through `AuthProvider`, `ContentBackend` and a small `InPlaceHost` port.

## What an editor sees

1. Click **Edit**. The first time in a tab, a sign-in dialog opens: on the live site, paste a fine-grained personal access token with Contents read and write on this repository (only write collaborators get in); on `npm start`, type a display name. "Remember on this device" is on by default, with a warning about shared devices. A remembered session is verified once per tab; if it stopped working it is forgotten and the dialog says why (when GitHub cannot be reached it is kept, and the editor shows the reason with **Close**).
2. The edit bar sticks under the navbar: **Visual** / **Raw**, **Page settings**, **Page actions**, an "Unsaved changes" marker, the commit message (default `Update <title>`, for a folder intro `Update <path> intro`), **Cancel** and **Save**. Below it the formatting toolbar sticks while the page scrolls.
3. The title is edited where the page shows it; **Page settings** opens the frontmatter form (description, type, tags, resource, sidebar position). The body is edited in the page's own look: headings, lists, tables and code look like the rendered page, admonitions are the site's real admonition component, tabs are the site's tabs (one panel at a time, double-click a tab to edit its props, the gear edits the tab group, "Add tab" appends one), and 3D viewers show the real model with their props behind a settings button.
4. **Raw** shows the whole file (frontmatter and body) in CodeMirror 6. A page the visual editor cannot write back safely opens in Raw with the message "This file could not be opened in the visual editor; editing raw MDX instead."
5. **Save** validates the page, then commits it (live site) or writes it to disk (dev server). **Cancel** with unsaved edits asks first; so do links to other pages of the site (confirming throws the edits away, they are not restored on the next Edit) and closing or reloading the tab. Jumps within the page (table of contents, heading anchors) do not ask.

**Page actions**: "New page in this folder..." (path prefilled with the current folder), "Rename...", "Delete..." (both in dialogs; not offered for folder intros), "Publish version..." (live site, role `editor`) and "Sign out". Frozen versions have no Edit button and no edit link; `log.md` and `code-maps/` are generated and not editable.

## Create your token

Saving on the live site needs a GitHub token that is allowed to write to this repository. A fine-grained token is the right kind:

1. Open GitHub, then Settings, Developer settings, Personal access tokens, Fine-grained tokens, **Generate new token**.
2. Give it a name and an expiry date you can live with.
3. **Repository access**: choose **Only select repositories** and pick `documentation-system`.
4. **Repository permissions**: set **Contents** to **Read and write**. **Metadata: Read-only** is added automatically.
5. Generate it, copy it once, and paste it into the sign-in dialog.

Sign-in checks this for you. After the read checks, it makes one harmless write (a tiny Git blob that no branch points to, which GitHub cleans up by itself). A token that can read the repository but cannot write is refused with "This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write." This matters because, for a fine-grained token, GitHub's `permissions.push` flag shows your role in the repository, not what the token may do, so a token without Contents write used to sign in fine and fail only at the first save. A lost connection during the check is reported as such, never as "cannot write". A remembered session is not re-checked this way.

When a save fails, the editor says why and keeps your edits on the page, so you can fix the cause and press **Save** again:

| What GitHub said | What you see |
|---|---|
| 401 | "Your GitHub token has expired or was revoked." Sign out from Page actions and sign in with a new token. |
| 403 on a write | "This token can read the repo but cannot write to it." Give the token Contents: Read and write. |
| Rate limit (403 or 429 with `retry-after` or `x-ratelimit-remaining: 0`, or the text "secondary rate limit") | "GitHub is limiting how fast this token can make requests." with how long to wait. |
| Protected branch (403 or 422 with "Protected branch update failed") | 'The branch "main" is protected.' Ask a repository admin to allow the push. |
| Someone else saved first | The conflict screen described under Saving. |

## Saving

Every save goes through `ContentBackend.writePage` with the etag the page was loaded with, so the page, its regenerated folder index, `manifest.json`, code maps and a `log.md` entry land together (see [Content service](content.md)).

- **Live site** (`github` mode): one Git Data commit on `deployBranch` (`main`). If someone else changed the same page, the save stops with "Someone else changed this page since you opened it. Nothing was overwritten." and two actions: "Copy my version (Raw)" and "Reload latest". If only other files changed, the backend retries on the new head by itself.
- After a live save the page shows the saved version, read-only, with "Saved as abc1234 (view commit). The public site updates after the deploy finishes". The tab keeps that copy (`pendingEdits`, sessionStorage) across reloads until the site is served from a newer build (`customFields.buildSha`, set from `PLATFORM_BUILD_SHA` in the deploy workflow) or 15 minutes pass, which covers the GitHub Pages cache.
- **Dev server** (`local-disk` mode, `npm start`): the save goes to the dev server's own endpoint and the files land in the working tree with no commit; Docusaurus hot-reloads the page. The banner says "Saved to disk"; commit with your usual git flow. Publishing is not offered in this mode. `PLATFORM_EDIT_BACKEND=github npm start` uses the live path instead.
- A folder intro (`index.md`) is edited like any page; its generated okf block is shown rendered and read-only, and a save that would change it is refused.
- Images and 3D models uploaded from the editor are committed at once (`uploads/`, `models/`, `models/fbx/`) and shown from the browser's copy until the site serves them, so a new viewer renders immediately. After a reload that copy is gone, so while the site still answers 404 for the file the image or viewer reads it from the deploy branch on GitHub (`RichTextServices.getSiteAsset`).

## Composition

The editor sees only contract types. The one place that picks implementations is the site's composition root, `site/src/platform/inplace/`:

- `createInPlaceHost.ts` builds the `InPlaceHost` (`services/editor/src/host.ts`): in `github` mode `GithubTokenProvider` and `GithubBrowserBackend` with the session token; in `local-disk` mode, after a successful `ping` of the dev endpoint, `MockAuthProvider` and `HttpContentBackend` with the dev token (dev sign-ins are kept under their own storage key). It also supplies the session store, the router's navigation guard, page and commit URLs, `buildSha` and `onSignedIn` (which resets the site's own content backend so viewers use the new token).
- `skin.tsx` injects the site's `Admonition` into the editor (`RichTextSkin`), so the editor never imports theme code.
- `mountInPlaceEditor.tsx` is the entry of the lazy `inplace-editor` chunk: it builds the host, injects the editor stylesheet and mounts `InPlaceEditor` or `SavedPreview`.
- `site/src/theme/DocItem/Content` and `site/src/theme/EditThisPage` are swizzle wrappers (no eject) with no editor imports; they load the chunk with a dynamic `import()`.

A new sign-in method is a new entry in `signInPanels.tsx` plus its wiring in `createInPlaceHost.ts`; a new backend is wired in `createInPlaceHost.ts` only.

## Rich text editor

### One interface, one implementation

`src/richtext/RichTextEditor.ts` is the seam. A component gets the page body as Markdown (no frontmatter), `readOnly`, the components manifest and a `RichTextServices` object, and reports `onChange` and `onParseError`. The in-place editor pulls the Markdown back through a `RichTextHandle` (`getMarkdown()`) on save and when switching to Raw. `src/richtext/index.ts` exports `RichTextEditor`, today `PlateRichTextEditor` with the page-look kit. Raw mode has the same kind of seam: `src/rawtext/RawTextEditor.ts`, implemented with CodeMirror 6.

`createRichTextServices` gives the editor `baseUrl`, `uploadImage`, `uploadModel`, `listAssets`, `getAsset` and `defaultRef`. Upload paths and insert formats live in `src/richtext/assets.ts`: an image goes to `uploads/<name>` and is inserted with the base URL in front; a `.glb` or `.gltf` goes to `models/<name>` and an `.fbx` to `models/fbx/<name>`, inserted as `ModelViewer` or `FbxViewer` with a site-relative `src`.

### Markdown in and out

`src/richtext/plate/markdown/docsMarkdown.ts` holds the import and export rules on top of `@platejs/markdown` (remark with GFM, directives and MDX):

- Pages stay plain Markdown. Manifest components are written as JSX tags with no import lines, because the site registers them globally.
- A generated `<!-- okf:* -->` ... `<!-- /okf:* -->` block becomes one read-only block and is written back byte for byte. Other HTML comments are kept as small hidden markers.
- `:::note`, `:::tip`, `:::info`, `:::caution` and `:::danger` admonitions (with an optional `[Title]`) become callout blocks.
- Table column alignment, code fence meta, the page's own bullet marker and the compact `|---|` delimiter row are kept. Links are always written in the inline form.

The editor never makes a page dirty on its own, and a page saved without edits comes back byte for byte (`composeDocument.ts` rewrites only changed frontmatter keys and an edited body).

### When a page opens in Raw mode

Before import, `supportedSyntax.ts` scans the body for shapes the editor cannot write back safely, for example an unknown component, a JavaScript expression or `import` line, a paragraph wrapped over several lines, an image inside text, a link title, a list item with more than one block, or the old `:::note Title` admonition form. After import, a round-trip check compares the page with its own export by meaning. If either step finds a problem, the page opens in Raw.

### Blocks and toolbars

- `ModelViewer` and `FbxViewer`: the real viewer from `@platform/viewers` at the page's height, with a settings button for the props the components manifest lists. A `src` starting with `/` is shown from the site's base URL; otherwise `repo` + `path` (+ `ref`) is read through the backend.
- `Tabs` and `TabItem`: Infima tab markup, normalizers keep the shape Tabs, then TabItem, then blocks.
- Fixed toolbar: undo and redo, block type, marks, lists, link, image by URL, upload image, upload 3D model, insert from repo, table, code block, divider, insert admonition, insert tabs, insert component.
- The "/" menu offers basic blocks, each admonition and each manifest component. Markdown shortcuts work while typing; blocks have drag handles.

Only the free, MIT-licensed Plate parts are used.

## Look and stylesheet

The editor's styles are one Tailwind 4 entry, `src/theme-inpage/inplace.pcss`. The site plugin compiles it to a string inside the lazy chunk (`postcss-loader` with `@tailwindcss/postcss`, webpack `asset/source`), never through Docusaurus' CSS pipeline, which would merge it into the one stylesheet every reader downloads. It is injected as `<style data-platform-editor>` while editing and removed afterwards. It holds Tailwind's theme and utilities only (no global Preflight; resets are scoped to the editor chrome and its popovers), never generates `.container`, and maps every colour onto the site's Infima variables, so dark and light follow the site. Inside the page content the site's own rules win over the editor's utilities, which is how the edited page keeps its look. A test (`noGlobalCss.test.ts`) fails if any module reachable from the editor entry imports a `.css` file.

The Plate UI parts are vendored shadcn / Plate UI files under `src/richtext/plate/ui/`; `components.json` records where they came from, and the `@/` alias (set by the site plugin and the site `tsconfig.json`) is used only by those files.

## Tests

Vitest (`npm test`) covers the editor library: composing the saved file, the edit-session flow (`InPlaceEditor.test.tsx`: sign-in, remembered sessions, save with etag, conflict, validation, cancel, the navigation guard, Raw fallback, drafts, folder intros, page actions), pending edits, the sign-in dialog, the CodeMirror editor, the page look, the stylesheet isolation check, and all the Markdown round-trip suites. The site has unit tests for the composition root and the page rules, and an integration test of the dev disk endpoint.

The Playwright suite runs against the built site (`npm run e2e -w @platform/site`, which builds and serves it); GitHub is mocked in the browser by `site/e2e/support.ts` (a `FakeGitHub` seeded from this repository), and every test fails on a console error. It covers the Edit entry points and that readers download no editor code or styles before Edit, token sign-in, saving and the pending preview, the unsaved-changes guards, Raw mode, conflicts and the branch-moved retry, folder intros, page actions, theme isolation and the sticky toolbar, existing and newly added blocks (uploaded and repo 3D models, the component and "/" menus, tabs with editable props), and that every 3D viewer on the doc pages renders.

### Save errors and end-to-end coverage

`GitDataClient` (`services/content/src/github/apiErrors.ts`) turns GitHub's refusals into messages a person can act on and keeps the reason in `ContentError.details.reason` (`token-expired`, `cannot-write`, `cannot-read`, `rate-limited` with `retryAfterSeconds`, `branch-protected`). A failed save leaves the page in the editor with its edits, so the next **Save** retries.

The Playwright specs insert each editor feature, save, reload, open the editor again and check both the page and the saved MDX read back from the fake `main`: formatting, links, code blocks, images, tables, admonitions, Tabs, 3D models, Raw round trips (Visual to Raw and back leaves every character alone), repeated saves, and the save errors above (`FakeGitHub` in `support.ts` has read-only tokens, revoked tokens, a rate limit, a protected branch and a dead connection). `npm run e2e -w @platform/site` runs the built-site suite and then `playwright.dev.config.ts` (dev-mode saving on `npm start`: it creates a temporary page, checks that the file is written and no commit is made, and restores `site/docs` afterwards). `npm run e2e:live -w @platform/site` is for a person with a token: it needs `GITHUB_TOKEN` in the terminal (never a file; traces, videos and screenshots are off, the page snapshot in `error-context.md` is off, and the token box is emptied before any check can fail, because that snapshot lists the value of every text box), builds the site, signs in against the real GitHub, and on one temporary page saves, saves again within a minute, adds Tabs and an FBX model, then deletes the page. Each step is a real commit to `main`. Without the token it stops with a short message.

A pick from a toolbar menu (block type, admonition, component) focuses the editor at once, so keys typed right after the pick land in the page (`site/e2e/menu-focus.spec.ts`). When the menu has finished its close animation it gives the focus back to the editor only if nothing else took it, so a viewer's settings popover opened right after inserting the viewer stays open.

## Known minor issues

- The visual editor has no buttons to remove or reorder tabs yet (use Raw); renaming a tab is the tab's props dialog (double-click it). Only one tab of a group can be the default: ticking default on a tab clears it on the others.
- While editing, code blocks have no title bar or copy button of the page's own code blocks, and headings have no anchor links.
- Tables keep the editor's own table chrome (cell selection, borders) with the page's cell styling.
- After creating a page on the live site there is no page to open until the deploy finishes; the status line says so.
- The frontmatter form has no field for `sources`; they are edited in Raw.
- The New page dialog derives its default `resource` from `codeRepos[0]` only.
