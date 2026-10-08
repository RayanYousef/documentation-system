---
title: Editor service
description: "Describes the in-browser editor (Vite + React, page body in Plate behind the RichTextEditor interface): how it is composed from platform.config.js, what each screen, toolbar and dialog does, how Markdown is imported and written back, when a page opens in Raw mode, how frontmatter edits preserve YAML, how the Tailwind and arcade theme is applied, and how it is built, tested and deployed under /editor/; open it when changing editor behaviour or debugging a save from the UI."
type: system
tags: [platform, editor, vite, react, plate, markdown, tailwind, shadcn, frontmatter, theme]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/composition/createPlatform.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/App.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/components/BodyEditor.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/components/FrontmatterForm.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/frontmatter/yamlDoc.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/mdx/componentsManifest.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/RichTextEditor.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/index.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/createRichTextServices.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/assets.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/PlateDocument.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/docsMarkdown.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/supportedSyntax.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/markdown/componentRules.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/nodes/docsNodesKit.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/kits/editor-kit.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/toolbar/FixedToolbarButtons.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/richtext/plate/slash/SlashInputElement.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/session/SessionStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme/index.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme/tokens.css
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/src/theme/tailwind.css
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/components.json
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/vite.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/playwright.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/body.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/formatting.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/components.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/e2e/theme.spec.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/scripts/copy-editor.mjs
sidebar_position: 6
---

`@platform/editor` is a standalone React application built with Vite. It talks to the platform only through `AuthProvider` and `ContentBackend`; the concrete classes are chosen in one file. The page body is edited in [Plate](https://platejs.org) (MIT), hidden behind the editor's own `RichTextEditor` interface.

## Composition

`src/composition/createPlatform.ts` reads `platform.config.js` and returns `{ auth, backend(session), config, componentsUrl }`:

- `auth` is `MockAuthProvider` when `VITE_PLATFORM_AUTH=mock` or `auth.provider` is `mock`, otherwise `GithubTokenProvider({ owner: organizationName, repo: projectName })`.
- `backend(session)` is `HttpContentBackend(url)` when `VITE_PLATFORM_CONTENT` is set or `content.backend` is `http`, otherwise `GithubBrowserBackend` for `organizationName/projectName` on `deployBranch` under `sitePath`, with the session token.
- `componentsUrl` is `<baseUrl>platform/components.json`, produced by the site prebuild from `site/components.json`; a bundled default (`DEFAULT_COMPONENTS` in `src/mdx/componentsManifest.ts`) is used when the fetch fails.

This folder is the `editor-composition` lint element, the only part of the editor allowed to import `@platform/auth` and `@platform/content`. `PlatformContext.tsx` hands the result to the component tree.

## Screens and actions

- `LoginGate`: token (or mock name and role) input, "remember on this device" with a shared-device warning, provider errors shown inline; a stored session is re-verified on load and forgotten if verification fails.
- `FilePicker`: pages of the selected version. `index.md`, `log.md`, `AGENTS.md`, `README.md` and `code-maps/` are hidden; a folder's intro is edited through `FolderIntroEditor`, which only touches text before the generated markers (`src/mdx/folderIntro.ts`).
- `FrontmatterForm`: `title`, `description` (placeholder: "One sentence: when should someone open this page?"), `type` (dropdown of values in use plus a free-text new type), `tags` (comma-separated), `resource`, `sidebar_position`. Edits go through the `yaml` package's document API (`src/frontmatter/yamlDoc.ts`) so untouched lines, comments, quoting and scalar types survive. Only keys whose value really changed are rewritten; when nothing changed the frontmatter comes back byte for byte, and flow lists are written as `[a, b]`, the style the pages use.
- `BodyEditor`: the page body in the rich text editor (see below), with a Visual / Raw MDX switch above it.
- Save: `validatePage` runs locally and `ProblemList` shows problems; the backend's `VALIDATION` details are shown the same way. Dirty tracking guards page and version switches, rename, create, logout and page unload.
- `NewPageDialog` (default `resource` built from the first `codeRepos` entry), Rename, Delete, and `PublishDialog` (role `editor`, version label input). Frozen versions open read-only, and a read-only body shows no toolbars.

## Rich text editor

### One interface, one implementation

`src/richtext/RichTextEditor.ts` is the seam. A component gets the page body as Markdown (no frontmatter), `readOnly`, the components manifest and a `RichTextServices` object, and reports `onChange` and `onParseError`. The app pulls the Markdown back through a `RichTextHandle` (`getMarkdown()`) on save and when switching to Raw. `src/richtext/index.ts` is the only import path the app uses; it exports `RichTextEditor`, typed as the interface, which today is `PlateRichTextEditor` from `src/richtext/plate/`. Another editor, or a different storage format later, is a new sibling folder of `plate/` and a one-line change in `index.ts`; `App.tsx` and `BodyEditor.tsx` stay the same.

`createRichTextServices` (built once per page in `BodyEditor`) gives the editor what it needs from the platform: `baseUrl`, `uploadImage`, `uploadModel`, `listAssets` (cached per page, cleared on failure), `getAsset` and `defaultRef`. Editor code never calls `usePlatform()` itself. Upload paths and insert formats live in `src/richtext/assets.ts`, which has no React and no Plate code, so any editor shares them: an image goes to `uploads/<name>` and is inserted with the base URL in front; a `.glb` or `.gltf` goes to `models/<name>` and an `.fbx` to `models/fbx/<name>`, inserted as `ModelViewer` or `FbxViewer` with a site-relative `src`.

### Markdown in and out

`src/richtext/plate/markdown/docsMarkdown.ts` holds the import and export rules on top of `@platejs/markdown` (remark with GFM, directives and MDX):

- Pages stay plain Markdown. Manifest components are written as JSX tags with no import lines, because the site registers them globally.
- A generated `<!-- okf:* -->` ... `<!-- /okf:* -->` block becomes one read-only block and is written back byte for byte. Other HTML comments are kept as small hidden markers.
- `:::note`, `:::tip`, `:::info`, `:::caution` and `:::danger` admonitions (with an optional `[Title]`) become callout blocks.
- Table column alignment, code fence meta (such as `title="x.ts"`), the page's own bullet marker (`*` or `-`) and the compact `|---|` table delimiter row are kept. Links are always written in the inline form (link text in square brackets, the URL in parentheses), never in the angle-bracket autolink form, which MDX cannot read.
- Text such as `site:build` stays plain text instead of being escaped.

The editor never makes a page dirty on its own. The baseline is the export of the freshly loaded page, so loading and normalising do not count, and `getMarkdown()` returns the loaded text byte for byte when nothing was edited.

### When a page opens in Raw mode

Before import, `supportedSyntax.ts` scans the body for shapes the editor cannot write back safely, for example an unknown component, a JavaScript expression, a paragraph wrapped over several lines, an image inside text, a link title, a list item with more than one block, two lists of the same kind next to each other, or the old `:::note Title` admonition form. After import, a round-trip check compares the page with its own export by meaning. If either step finds a problem, the editor calls `onParseError`, renders nothing, and the app opens the page in the Raw MDX text area with the message "This file could not be opened in the visual editor; editing raw MDX instead." The page can still be edited and saved there.

### Custom blocks

`src/richtext/plate/nodes/` holds the docs blocks, registered in `docsNodesKit.tsx`:

- `ModelViewer` and `FbxViewer`: a live 3D preview (the cores from `@platform/viewers`, loaded lazily) plus input fields for the props the components manifest lists. A `src` starting with `/` is shown from the site's base URL; otherwise `repo` + `path` (+ `ref`, else the repo's `defaultRef`) is read through the backend.
- `Tabs` and `TabItem`: a tab group whose children are tab items with editable Markdown inside; "Add tab" appends a tab, and normalizers keep the shape Tabs, then TabItem, then blocks.
- A component whose manifest `preview` is `generic` shows its tag and attributes; one with children has editable Markdown inside.
- The generated okf block (read-only), HTML comments, admonition callouts and images (with `src` and alt inputs).

Which tag maps to which block comes from `site/components.json`, through `componentRules.ts`.

### Toolbar and "/" menu

- Fixed toolbar, sticky at the top of the page: undo and redo; block type (text, headings 1 to 6, lists, code, quote); bold, italic, underline, strikethrough, inline code; bulleted, numbered and to-do lists; link, image by URL, upload image, upload 3D model, insert from repo, table, code block, divider; insert admonition, insert tabs, insert component (one item per manifest entry).
- Floating toolbar over a text selection: block type, the marks and link. A floating link toolbar edits, opens or removes a link.
- The "/" menu (not inside code blocks) has two groups: basic blocks (text, headings 1 to 3, lists, code block, table, quote, divider) and docs blocks (each admonition and each manifest component).
- Markdown shortcuts work while typing (`#`, `*` or `>` followed by a space, three backticks, `**`); there is no autoformat that replaces text with symbols. Shift+Enter adds a line break in a paragraph only; Ctrl+Enter leaves a code block, quote or table. Top-level blocks have drag handles in the left gutter. Code blocks are coloured with lowlight's common languages.

The editor uses only the free, MIT-licensed Plate parts: no AI, comments, suggestions, collaboration or upload server.

## Theme

The look lives in one module, `src/theme/`, imported once from `src/main.tsx` as `./theme/index.js`:

- `tokens.css`: the arcade palette as `--ed-*` variables. Dark is the default (`index.html` sets `data-theme="dark"`); light applies when `html` has `data-theme="light"`, or when no `data-theme` is set and the OS prefers light. Every colour goes through these tokens.
- `tailwind.css`: Tailwind CSS 4 (through `@tailwindcss/vite`) and the shadcn variables the Plate UI files use, each mapped onto an `--ed-*` token, so Plate and the app chrome share one look in dark and light. It declares the layer order `theme, base, chrome, components, utilities`.
- `shadcn-variants.css`: a verbatim copy of shadcn's own Tailwind variants and utilities (MIT); the shadcn CLI is not a dependency.
- `arcade.css`: the app chrome (sidebar, buttons, the Visual / Raw segmented control, fields, frontmatter panel, modals, editor frame) inside `@layer chrome`.
- `index.ts`: imports the three CSS files, `tailwind.css` first.

The Plate UI parts are vendored shadcn / Plate UI files under `src/richtext/plate/ui/`; `components.json` records the shadcn settings and the `@plate` registry they came from, and the `@/` path alias is used only by those files. A new look is a sibling module imported from `main.tsx` in place of `./theme/index.js`.

## Build and deploy

`vite.config.ts` sets `base` to `<baseUrl>editor/` from `platform.config.js` and adds the React and Tailwind plugins. `npm run build -w @platform/editor` type-checks and builds `services/editor/dist`; `scripts/copy-editor.mjs` copies it into `site/build/editor/` so GitHub Pages serves the editor at `https://RayanYousef.github.io/documentation-system/editor/`. The site navbar links there when `features.editor` is true.

Development: `npm run dev -w @platform/editor` with `VITE_PLATFORM_AUTH=mock` and `VITE_PLATFORM_CONTENT=http://127.0.0.1:4321` against `node services/editor/e2e/content-server.mjs` (a `serveContentBackend` over a `LocalFolderBackend`).

## Tests

Vitest unit and component tests (`npm test -w @platform/editor`) cover the app (`dialogs.test.tsx`, `BodyEditor.test.tsx`, `yamlDoc.test.ts`, `folderIntro.test.ts`, `componentsManifest.test.ts`, `SessionStore.test.ts`) and the rich text editor under `src/richtext`: the services and asset rules, the viewer URL logic, the Plate document and its change tracking, table and insert transforms, Shift+Enter, prop fields, the toolbar, and the Markdown rules. The Markdown tests round-trip frozen copies of real pages byte for byte, check every live page under `site/docs` for the same meaning, and cover the Raw-mode scan and the round-trip guard.

Six Playwright specs run with `npm run e2e -w @platform/editor`, one at a time against one content server and one temporary git repository. Every test fails on a console error (`e2e/support.ts`), and each test seeds the pages it changes.

- `e2e/editor.spec.ts`: sign in with the mock provider, the file picker, every frontmatter field, the unsaved-changes guard, local and server validation problems, create, rename and delete, and publishing frozen version `1.1.0`, which then opens read-only.
- `e2e/body.spec.ts`: typing and saving, untouched pages keep every byte, one edit keeps every other construct, Visual to Raw and back, the Raw fallback for pages the editor cannot open, and the save-conflict message.
- `e2e/formatting.spec.ts`: block types, marks, links, inserts, tables, the "/" menu, Markdown shortcuts, undo and redo, to-do lists, the floating toolbar and admonitions, each checked against the saved Markdown.
- `e2e/components.spec.ts`: image and 3D model uploads, inserts from the repo, viewer previews and prop editing, tabs, and the Insert component menu.
- `e2e/folder-intro.spec.ts`: a folder intro is saved and the generated okf block is untouched.
- `e2e/theme.spec.ts`: in dark and light, the editor, its menus, popovers and dialogs use the arcade palette; an unchecked to-do checkbox has enough contrast; the sign-in screen and app dialogs follow the theme; the toolbar sticks flush to the top of the scrolled page.

## Known minor issues

- Rename and Delete use native `window.prompt` and `window.confirm` dialogs rather than the shared `Modal`.
- The frontmatter form has no field for `sources`; they are edited in the Raw MDX view.
- The New page dialog derives its default `resource` from `codeRepos[0]` only; other declared repositories must be typed by hand.
- Component insertion falls back to the bundled component list silently when `components.json` cannot be fetched.
- The Phase 1 HTTP bridge (`serveContentBackend`) has no authentication, which is why it is limited to local development and the e2e until the Phase 2 server exists.
