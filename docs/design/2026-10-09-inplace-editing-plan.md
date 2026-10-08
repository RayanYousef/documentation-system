# Plan: In-place editing on the Docusaurus page (replaces the standalone `/editor/` app)

Repo: `H:\Personal-Projects\cloud-documentation` (GitHub `RayanYousef/documentation-system`, `main`, clean at `df13d2c`).
Branch to create: `feat/inplace-editing` from `main`. One PR. Saves made *by the feature* commit to `main`; the feature itself ships via PR.

---

## 0. Verified facts this plan is built on (read from the code, not assumed)

| # | Fact | Where |
|---|---|---|
| F1 | Auth today = **fine-grained PAT paste** (`GithubTokenProvider`): `verify` calls `GET /repos/{o}/{r}` (needs `permissions.push`) then `GET /user`. No OAuth / device flow (device flow endpoints have no CORS, so it would need a server; out of scope). `MockAuthProvider` = display name, no network. | `services/auth/src/GithubTokenProvider.ts`, `MockAuthProvider.ts` |
| F2 | Session store: memory first, `localStorage['docs-platform.session']` only when "Remember on this device" is ticked. The site already reads the same key (viewers fetch private assets with it). | `services/editor/src/session/SessionStore.ts`, `site/src/platform/createContentBackend.ts` |
| F3 | Every save goes through `planPageChanges`: validates the page, runs `generateBundle` (index blocks, `manifest.json`, code maps) and prepends a `log.md` entry, all written **in the same commit** (GitHub: one Git Data commit; local: `writeFiles` + `git commit`). So `okf:check` stays green after a save **without any extra manifest step** — as long as the commit is computed on the real head (see F9). | `services/content/src/writePipeline.ts`, `GithubBrowserBackend.commitChanges`, `LocalFolderBackend.commitChanges` |
| F4 | Conflict detection: `readPage` returns `etag` = git blob sha (GitHub) or FNV hash (local); `writePage(..., {expectedEtag})` throws `ContentError('CONFLICT')`. | `GithubBrowserBackend.writePage`, `LocalFolderBackend.writePage` |
| F5 | `LocalFolderBackend` **always runs `git add -A` + `git commit`** in `siteDir`. Unusable as-is for the dev server (would sweep the developer's unrelated working-tree changes into a commit). | `services/content/src/local/git.ts` `commitAll` |
| F6 | `serveContentBackend` sends `Access-Control-Allow-Origin: *` and has no auth. Exposing that on a dev machine would let *any website* POST writes to disk. Must not be reused as-is for the dev path. | `services/content/src/http/serveContentBackend.ts` |
| F7 | Docusaurus 3.10.2 webpack: `.[jt]sx?` files outside `node_modules` are transpiled by Docusaurus' babel (TS preset); `resolve.symlinks: true`, so the workspace package `@platform/editor` resolves to its real path `services/editor/src/**` and **is transpiled**. No `resolve.extensionAlias` → the editor's `./x.js`-style imports of `.ts/.tsx` files will NOT resolve without adding `extensionAlias`. | `node_modules/@docusaurus/core/lib/webpack/base.js` |
| F8 | **CSS trap:** Docusaurus `splitChunks.cacheGroups.styles` (`type: css/mini-extract`, `chunks: 'all'`, `enforce: true`) merges **all** CSS — including CSS imported from lazy chunks — into the one global `styles.css` every reader downloads. Importing the editor's Tailwind/shadcn CSS normally would leak it to every reader and onto every page. | same file, `optimization.splitChunks` |
| F9 | Pre-existing race: `GitDataClient.commitFiles` re-reads the head and commits on top of it, but the regenerated files were computed from the *earlier* snapshot. Two near-simultaneous saves of different pages can leave a stale `manifest.json`/index block on `main` → `okf:check` fails in `deploy-pages.yml`. In-place editing makes concurrent saves more likely. | `services/content/src/github/gitData.ts` |
| F10 | Docusaurus `start` merges a plugin's `configureWebpack(...).devServer` into its dev-server config via `webpack-merge` (`config.devServer`). That is the hook for a same-origin dev-only middleware. | `@docusaurus/core/lib/commands/start/webpack.js` line ~144 |
| F11 | `DocItem/Content` renders `div.theme-doc-markdown.markdown` > synthetic `<header><h1>` (from frontmatter title) + `<MDXContent>`. It and `EditThisPage` are **not** in theme-classic's "safe" swizzle list → `--wrap --danger`. Wrapping (not ejecting) keeps the risk low. | `@docusaurus/theme-classic/lib/theme/DocItem/Content/index.js`, `getSwizzleConfig.js` |
| F12 | `@docusaurus/router` re-exports `useHistory` (react-router v5) → `history.block()` is available for the navigation guard. | `@docusaurus/core/lib/client/exports/router.d.ts` |
| F13 | Lint boundaries already forbid `site/**` from importing `@platform/editor|auth|content`; only `site/src/platform/**` (site-composition) may. This is exactly the "readers never pull the editor" guarantee we want — keep it, extend it. | `eslint.config.js` |
| F14 | The editor app's own composition root uses `import.meta.env` (Vite-only); nothing else in `services/editor/src` does. | `services/editor/src/composition/createPlatform.ts` |
| F15 | Plate kit composition is already a seam: `PlateDocument` takes `plugins`; `PlateRichTextEditor` passes `EditorKit`. A different look = a different kit (`.withComponent(...)`), no changes to the Markdown rules. The only hard-coded look is `<Editor variant="docs">` and the toolbar's `-top-6` sticky offset. | `plate/PlateDocument.tsx`, `plate/kits/*.tsx` |
| F16 | Vendored shadcn UI files reference bare CSS vars (`var(--secondary)`, `var(--foreground)`, `var(--radius)`) → those vars must exist while editing. The site's `custom.css` defines `--primary`, `--bg`, `--surface`, `--text`, `--info`, `--outline`, `--interactive` on `:root`; only `--primary` collides with shadcn names. The editor's `tokens.css` sets `:root { color-scheme: dark }` and its `tailwind.css` imports Preflight — both would break the site if loaded globally. Docusaurus and the editor both key light/dark on `html[data-theme]` (compatible). | `site/src/css/custom.css`, `services/editor/src/theme/*` |
| F17 | `@codemirror/*` is not installed (empty dir). `@tailwindcss/postcss` is not installed; `postcss-loader` and `tailwindcss` 4 are. `@playwright/test` is installed (root). | `node_modules` |
| F18 | `index.md` frontmatter is restricted by the validator (`index-frontmatter` rule: extra keys rejected, `title` required). The okf generated block inside index pages is already a read-only void block in Plate and round-trips byte for byte (fixtures include index pages). | `packages/okf-core/src/validate.ts`, `plate/nodes/OkfGeneratedElement.tsx`, `__fixtures__/pages/*index*.md` |
| F19 | Old e2e did **not** mock GitHub; it used `MockAuthProvider` + `HttpContentBackend` → `LocalFolderBackend` on a temp git repo. GitHub mocking exists only in unit tests (`services/content/test/FakeGitHub.ts`, `services/auth/test/fakeGithubAuth.ts`). | `services/editor/e2e/*`, tests |
| F20 | Deploy: `deploy-pages.yml` builds packages → `okf:check` → `site:build` (= build editor + build site + `copy-editor.mjs`) → `gh-pages`. Pages serves with ~10 min CDN cache. | `.github/workflows/deploy-pages.yml`, `package.json` |

---

## 1. Decisions (made; rationale in one line each)

| ID | Decision | Why |
|---|---|---|
| D1 | **Swizzle-wrap** `@theme/DocItem/Content` (render original until Edit; then the editor in the *same* `div.theme-doc-markdown.markdown`) and `@theme/EditThisPage` (footer link becomes the in-place Edit trigger). No eject. A **local Docusaurus plugin** `site/plugins/platform-inplace-edit/` owns webpack config, dev middleware and global data. | Same layout/sidebar/TOC/theme; wrapping survives Docusaurus upgrades better than ejecting. |
| D2 | `services/editor` stops being an app and becomes a **library workspace** `@platform/editor` that exports TS source (`./inplace` entry, `./inplace/styles.pcss`). Docusaurus' babel compiles it (F7) with `resolve.extensionAlias {'.js': ['.ts','.tsx','.js']}` and alias `@` → `services/editor/src` (vendored shadcn files). | Reuse Plate, nodes/kits, components.json blocks, dialogs, yamlDoc, SessionStore unchanged; one bundler; no second build/copy step. |
| D3 | **One composition root for editing: `site/src/platform/inplace/`** (site-composition element). It picks `AuthProvider` + `ContentBackend` per mode and hands the editor an `InPlaceHost` (contract-typed object). `services/editor/src/composition/` and the `editor-composition` lint element are deleted. | Contracts-first: editor sees only contract types; implementations wired in exactly one place; lint (F13) guarantees readers' code can't import the editor. |
| D4 | **Lazy load**: Edit click → `import(/* webpackChunkName: "inplace-editor" */ '@site/src/platform/inplace/mountInPlaceEditor')`. Server (SSR) build replaces that module with a stub via `NormalModuleReplacementPlugin` (Plate never enters the SSR bundle). | Readers pay 0 bytes; faster, safer SSR build. |
| D5 | **CSS isolation**: the editor's styles are one Tailwind 4 entry `services/editor/src/theme-inpage/inplace.pcss`, compiled by a dedicated webpack rule (`postcss-loader` + `@tailwindcss/postcss`, `type: 'asset/source'`) into a **string** inside the lazy chunk, injected as `<style data-platform-editor>` on mount and **removed on exit**. The `.pcss` extension keeps it out of Docusaurus' CSS rule and its global `styles` chunk (F8). Contents: Tailwind `theme` + `utilities` only (no global Preflight), a scoped Preflight copy under `.ped-ui` (edit bar, dialogs, popover portals), shadcn vars mapped onto Infima/site vars (no `color-scheme`, `--primary` = `var(--ifm-color-primary)`, i.e. same value the site already uses), `@source "../"` limited to `services/editor/src` and `@source not inline("container")`. A unit test forbids `.css` imports reachable from `src/inplace`. | Readers never get editor CSS; editing never restyles navbar/sidebar; exit restores the page exactly. |
| D6 | **Look = the page**: page content inside the editor is styled by Infima's `.markdown` rules (unlayered Infima beats layered Tailwind utilities — used deliberately). New additive "page look" kit: plain semantic elements for headings/paragraph/lists/quote/hr/table/code; admonitions render the real `@theme/Admonition` (injected through a `RichTextSkin` context from the site composition); Tabs render Infima `tabs`/`tabs__item--active` markup; viewers render the real `@platform/viewers` cores at page height with props in a popover; okf block = read-only live block. | "Real-looking blocks" without the editor importing site code (skin is injected = DIP). |
| D7 | **Live site save** = existing `GithubBrowserBackend.writePage` (Git Data commit to `deployBranch` = `main`, page + regenerated files + log in one commit). Source fetched with `backend.readPage('current', path)` (same blob-sha etag the conflict check uses; not the Contents API, whose sha semantics would duplicate F4 logic). Path mapping: `useDoc().metadata.source` `@site/docs/<path>` → `<path>`; `metadata.version === 'current'` only. | Reuses proven write path; okf stays green (F3). |
| D8 | **"Shows edited content immediately" (live)**: after Save the page shows the saved document rendered read-only in the page look, with a banner "Saved as `abc1234` — the public site updates after the deploy finishes". A `pendingEdits` record (sessionStorage: path, text, commitSha, `buildSha` at save time, savedAt) keeps showing it after reload/navigation until the site's `customFields.buildSha` (from `PLATFORM_BUILD_SHA=${{ github.sha }}` in deploy) changes or 15 min TTL (covers Pages' 10 min CDN cache). | No API polling; honest about Pages latency. |
| D9 | **Local `npm start` save = write straight to disk through a dev-only, same-origin middleware** mounted by the plugin (`devServer.setupMiddlewares`, F10) at `<baseUrl>__platform/content/rpc`, backed by `LocalFolderBackend` with a new **`WorkingTreeCommitter`** (writes files, **no git commit**) — the developer commits with their normal git flow. Docusaurus' file watcher + HMR then shows the change. Security: loopback remote address only (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) even with `--host 0.0.0.0`; `Host` and `Origin` must be loopback/same-origin (DNS-rebinding + CSRF); per-process random token (from plugin global data) required in `X-Platform-Dev-Token`; **no CORS headers**; JSON only; body limit 25 MB; method allow-list (`listVersions, listPages, readPage, writePage, createPage, deletePage, renamePage, uploadAsset, listAssets, getAsset`; **no `publishVersion`**); paths confined by `assertPagePath` (bundle-relative, no `..`/dot segments) and asset path check, all under `site/` (`siteDir`). Client probes `GET .../ping` first; if absent (e.g. `docusaurus build --dev`) it falls back to GitHub mode. Env `PLATFORM_EDIT_BACKEND=github` forces GitHub mode on the dev server (to try the live path locally). | Instant feedback via hot reload, no token needed locally, no surprise commits on a feature branch; cannot be reached cross-origin or from the LAN. |
| D10 | **Auth UX**: first Edit (per tab) opens the existing sign-in UI as a modal: live → PAT panel (`GithubTokenProvider`), dev → display-name panel (`MockAuthProvider`; nothing is committed in dev, author is only used in `log.md`). Panels come from a registry keyed by `auth.id` (add a provider = add a panel). "Remember on this device" **defaults to on** (requirement), shared-device warning kept, "Sign out" in the page actions menu. A stored session is verified once per tab; on failure it is forgotten and the modal shows why. After sign-in, `resetContentBackend()` so viewers use the token. | Reuse; zero contract changes. |
| D11 | **Versioned docs**: no Edit button and no footer edit link on non-`current` versions (frozen; editing them on GitHub would break the freeze). Also not editable: `log.md`, `code-maps/**` (generated). | Matches F3/OKF reserved files. |
| D12 | **Folder intros (category `index.md`)** edit in place with the same editor; the okf block is a read-only live block; Save additionally asserts the generated block is byte-identical (`splitFolderIntro`) before calling the backend. Index pages get the inline title only (no settings panel; other keys via Raw) because of F18. | Closes the Plate-plan gap; keeps validator rules. |
| D13 | **Raw mode = CodeMirror 6** (`@codemirror/state, view, commands, language, lang-markdown`) behind a new `RawTextEditor` seam (`src/rawtext/`), mirroring `RichTextEditor`. Visual/Raw toggle in the edit bar; Raw shows the whole file (frontmatter + body); auto-fallback to Raw with the existing message when Plate can't import the page. | Closes the Plate-plan gap; seam keeps it swappable. |
| D14 | **F9 fix**: `GitDataClient.commitFiles` takes `expectedParent` (the snapshot's commit) and never rebases silently; `GithubBrowserBackend` retries the whole operation (re-snapshot, re-check etag, re-plan) up to 2 times on a ref-update rejection, then surfaces `CONFLICT`. | Concurrent in-place saves can't leave stale manifests on `main`. |
| D15 | `/editor/` is removed. A static `site/static/editor/index.html` meta-refresh to `<baseUrl>` ("Editing moved into the pages: open a page and click Edit") prevents 404s for bookmarks. `features.editor` keeps its name; meaning becomes "show in-place Edit". | Clean removal, no dead links. |
| D16 | Commit message: optional input in the edit bar, default `Update <title>` (index: `Update <path> intro`). Save always commits to `deployBranch` (`main`). | Parity with old app. |

### Old-app features: carried vs dropped

| Old feature | In-page | Notes |
|---|---|---|
| Sign in / remember / forget token | **Carried** (modal on first Edit; Sign out in actions menu) | D10 |
| Body Visual editor (toolbar, "/", floating, drag, tables, uploads, insert from repo, components menu) | **Carried** | page-look kit |
| Raw MDX | **Carried, upgraded** to CodeMirror 6 | D13 |
| Frontmatter form | **Carried**: inline H1 title + "Page settings" panel (description, type, tags, resource, sidebar_position) | `FrontmatterForm` reused |
| Folder intro editor | **Carried, upgraded** (in place, Plate) | D12 |
| Validation problems | **Carried** (`ProblemList` under the edit bar) | |
| Commit message | **Carried** | D16 |
| Unsaved-changes guard | **Carried** (router `history.block` + `beforeunload` + Cancel confirm) | |
| Save conflict | **Carried** (message + "Copy my version (Raw)" / "Reload latest") | |
| New page | **Carried** in Page actions → "New page in this folder…" (`NewPageDialog`, folder prefilled). Dev: navigate once the route appears; live: link + "available after deploy" | |
| Rename | **Carried** (Modal; fixes the old `window.prompt` known issue) | |
| Delete | **Carried** (Modal confirm; then navigate to parent category / home) | |
| Publish version | **Carried on live only** (role `editor`, actions menu). **Dropped in dev mode** (would write versioned_docs + git tag on the dev machine; blocked by the method allow-list). | |
| File picker + filter | **Dropped** — the site sidebar/search *is* the navigation. | |
| Version selector / read-only frozen view | **Dropped** — the site's version dropdown shows frozen pages; frozen pages have no Edit (D11). | |
| Editing `log.md` / `code-maps` | Was already hidden; stays not editable. | |
| Standalone `/editor/` URL, Vite dev server, `copy-editor` step | **Dropped** (D15) | |

---

## 2. Target architecture

```
Reader (no edit):  DocItem/Content wrapper ──> original Content (unchanged HTML)  + tiny "Edit" button (site element, ~2 KB)
                                   │ click
                                   ▼
            import('inplace-editor' chunk)  ── site/src/platform/inplace/mountInPlaceEditor.tsx   (site-composition)
                 │ builds InPlaceHost:  auth  = GithubTokenProvider | MockAuthProvider     (@platform/auth)
                 │                      backend(session) = GithubBrowserBackend | HttpContentBackend(dev rpc + token fetch)  (@platform/content)
                 │                      skin  = { Admonition: @theme/Admonition }, navigation guard (history.block), config, mode, capabilities
                 │ injects <style data-platform-editor> (inplace.pcss string)
                 ▼
            <InPlaceEditor host page skin onExit>   (@platform/editor/inplace — contract types only)
                 ├─ SignInDialog (panel registry by auth.id) → BrowserSessionStore
                 ├─ EditBar (Visual|Raw, Page settings, Page actions ▾, commit msg, Cancel, Save, status)
                 ├─ InlineTitle + PageSettingsPanel (FrontmatterForm/yamlDoc)
                 ├─ RichTextEditor (Plate, page-look kit, skin)  |  RawTextEditor (CodeMirror 6)
                 └─ save → backend.writePage(current, path, text, {expectedEtag}) → onExit({saved})

Dev server only:  plugin devServer middleware  <baseUrl>__platform/content/{ping,rpc}
                    → guards (loopback, Host/Origin, token, allow-list, size) → createContentRpcHandler
                    → LocalFolderBackend({ siteDir, committer: WorkingTreeCommitter }) → writes site/docs/** → Docusaurus HMR
```

---

## 3. Ordered tasks

Each task ends with: `npm run typecheck && npm run lint && npm test` green (plus the task-specific checks). Tasks 1–2 are the feasibility gate: if Task 1 fails, stop and report (fallback in Risk R1).

### Task 1 — Feasibility spike: Plate inside Docusaurus webpack, lazy + isolated CSS (gate)

Create
- `site/plugins/platform-inplace-edit/index.mjs` — plugin `platform-inplace-edit(context, { enabled })`:
  - `configureWebpack(config, isServer)` returns: `resolve.extensionAlias: { '.js': ['.ts', '.tsx', '.js'] }`; `resolve.alias['@'] = <repo>/services/editor/src`; `module.rules += { test: /\.pcss$/i, type: 'asset/source', use: [{ loader: require.resolve('postcss-loader'), options: { postcssOptions: { plugins: [tailwindPostcss()] } } }] }`; when `isServer`: `new webpack.NormalModuleReplacementPlugin(/platform[\\/]inplace[\\/]mountInPlaceEditor/, <stub>)`.
  - `contentLoaded({ actions })` → `setGlobalData({ enabled, mode: 'github' })` (dev fields added in Task 3).
- `site/plugins/platform-inplace-edit/serverStub.tsx` — `export default function InPlaceEditorStub() { return null }` (+ matching named exports).
- Spike file (deleted at end of task, never committed): a lazy import of `@platform/editor`'s existing `PlateRichTextEditor` with a hard-coded markdown.

Modify
- `site/docusaurus.config.js`: add `['./plugins/platform-inplace-edit/index.mjs', { enabled: platform.features.editor }]` to `plugins`.
- `site/package.json`: deps `@platform/editor`, `@platform/auth`; devDeps `@tailwindcss/postcss@^4.3`, `postcss-loader` (explicit), `@playwright/test`.
- `services/editor/package.json`: add `"exports": { "./inplace": "./src/inplace/index.ts", "./inplace/styles.pcss": "./src/theme-inpage/inplace.pcss" }` (entries filled in later tasks; spike uses a temporary export).

Verify (document numbers in the PR description)
- `npm run site:build` passes; `site/build/assets/js/inplace-editor.*.js` (or `inplace-editor` + numeric vendor chunks) exist; **no** Plate code in the initial page JS (grep built HTML-referenced scripts for `data-slate-node` → none); `site/build/assets/css/styles.*.css` contains **no** Tailwind/shadcn markers (`--tw-`, `data-slot`).
- `npm run site:start`, open a doc, trigger the spike → editor renders, React single instance (no "Invalid hook call").
- Record initial-JS size before/after (must be ≈ equal) and lazy chunk size.

### Task 2 — Content service hardening (seams + race fix)

Create
- `services/content/src/http/contentRpcHandler.ts` — `createContentRpcHandler(backend, { allow?: (keyof ContentBackend)[], maxBodyBytes?: number }) : (req, res) => Promise<void>` (logic moved out of `serveContentBackend`, **no CORS headers**, rejects methods outside `allow`, 413 over limit).
- `services/content/src/local/committer.ts` — `interface Committer { commit(siteDir, message, author): Promise<string>; tag(siteDir, name, sha): Promise<void> }`; `GitCommitter` (today's `commitAll`/`createTag`) and `WorkingTreeCommitter` (returns `''`, `tag` throws `ContentError('FORBIDDEN', 'Publishing needs a git commit; run it from the CLI')`).
- Tests: `services/content/test/contentRpcHandler.test.ts`, `services/content/test/committer.test.ts`, `services/content/test/GithubBrowserBackend.race.test.ts`.

Modify
- `services/content/src/http/serveContentBackend.ts` — uses the handler; keeps its own CORS headers (dev/e2e tool behaviour unchanged).
- `services/content/src/local/LocalFolderBackend.ts` — option `committer?: Committer` (default `new GitCommitter()`); `commitChanges`/`uploadAsset`/`publishVersion` call it. Return `commitSha: ''` when not committed.
- `services/content/src/node.ts` — export `committer.ts`, `contentRpcHandler.ts`.
- `services/content/src/github/gitData.ts` — `commitFiles(branch, writes, deletes, message, author, { expectedParent? })`: when given, uses it as parent and base tree; PATCH ref `force:false` → 422 becomes `ContentError('CONFLICT', ..., { reason: 'branch-moved' })`.
- `services/content/src/github/GithubBrowserBackend.ts` — snapshot keeps `commitSha`; `commitChanges` passes `expectedParent`; `writePage/createPage/deletePage/renamePage` wrap in `withRetry(2)` that retries only on `details.reason === 'branch-moved'` (etag re-checked on retry, so a real edit conflict still surfaces).

Tests
- `describeContentBackendContract` passes for `LocalFolderBackend` with **both** committers (add the second describe).
- Race: FakeGitHub — snapshot, then another commit lands on `main` touching page B, then save page A → result commit's `manifest.json` contains both changes; `okf` `generateBundle` over the resulting tree reports no stale files.
- Handler: allow-list rejection, 413, error mapping, no `Access-Control-*` headers.
- `HttpContentBackend.test.ts` unchanged and green.

### Task 3 — Dev-only disk endpoint (secure)

Create
- `site/plugins/platform-inplace-edit/devContentMiddleware.mjs` — `createDevContentMiddleware({ siteDir, codeRepos, baseUrl, token })` returning an Express-style middleware for `<baseUrl>__platform/content/ping` (GET → `{ ok: true }`) and `/rpc` (POST): guards in this order → remote address loopback; `Host` header hostname ∈ {localhost, 127.0.0.1, [::1]}; `Origin` (if present) equals `http(s)://<Host>`; `Content-Type: application/json`; `X-Platform-Dev-Token === token` (timing-safe compare) → `createContentRpcHandler(new LocalFolderBackend({ siteDir, codeRepos, committer: new WorkingTreeCommitter() }), { allow: [...D9 list], maxBodyBytes: 25 MB })`. Every rejection = 403 JSON with a reason, logged once to the dev console.
- `site/plugins/platform-inplace-edit/mode.mjs` — `resolveEditMode({ nodeEnv, forceBackend })` → `'local-disk' | 'github'` (pure; unit-tested).
- `site/plugins/platform-inplace-edit/devContentMiddleware.test.ts` (vitest, node): temp copy of `site/docs` + `versions.json` into a tmp `siteDir`; drive the middleware through a real `node:http` server and `HttpContentBackend` with a token-adding `fetch`:
  1. `writePage` writes the file, regenerates `manifest.json` / index block, prepends `log.md`, **creates no git commit** (tmp dir is a git repo; `git rev-list --count HEAD` unchanged).
  2. wrong/missing token → 403; non-loopback remote (stub `req.socket.remoteAddress = '192.168.1.5'`) → 403; `Host: evil.example` → 403; `Origin: https://evil.example` → 403; `text/plain` body → 403.
  3. `readPage('current', '../package.json')`, `'docs/../../x.md'`, `'.hidden/x.md'` → error, nothing read outside `siteDir`; `uploadAsset('../x.png')` → VALIDATION.
  4. `publishVersion` → rejected by allow-list.
  5. expectedEtag mismatch after an out-of-band disk edit → `CONFLICT`.

Modify
- `site/plugins/platform-inplace-edit/index.mjs`: in `local-disk` mode, generate `token = crypto.randomBytes(32).toString('hex')` once; `configureWebpack` (client, non-server) returns `devServer: { setupMiddlewares(mw, ds) { mw.unshift(devMiddleware); return mw; } }` — **verify** Docusaurus' own `setupMiddlewares` (eval-source-map for the error overlay) still runs; if `webpack-merge` replaces it, chain it explicitly (call the previous function captured from `config.devServer?.setupMiddlewares` if present, else accept the overlay degradation and note it). `setGlobalData({ enabled, mode, endpoint: '<baseUrl>__platform/content', devToken })` (token only in dev mode).
- `site/vitest.config.ts`: include `plugins/**/*.test.ts`, `src/**/*.test.ts`.
- `eslint.config.js`: new element `{ type: 'site-plugins', pattern: 'site/plugins/**', mode: 'full' }` allowed `site-plugins, contracts, okf-core, content, platform-config`; add `site/plugins/**/*.mjs` to the Node-globals block.
- `scripts/lint-boundaries.test.ts` + fixtures: `site/plugins` may import `@platform/content/node`; `site/src/theme/**` importing `@platform/editor` fails; `site/src/platform/**` importing it passes.

### Task 4 — Turn `services/editor` into a library (remove the app)

Delete
- `services/editor/index.html`, `src/main.tsx`, `src/App.tsx`, `src/PlatformContext.tsx`, `src/composition/createPlatform.ts` (folder), `src/components/FilePicker.tsx`, `src/components/FolderIntroEditor.tsx`, `src/theme/` (app chrome: `arcade.css`, `index.ts`; keep `shadcn-variants.css` + token values by moving them in Task 6), `vite.config.ts`, `playwright.config.ts`, `e2e/` (all 6 specs, `support.ts`, `content-server.mjs`).
- `scripts/copy-editor.mjs`, `scripts/copy-editor.test.ts`.

Create
- `services/editor/src/host.ts` — the editor's port types (contract-typed, no implementations):
  `InPlaceHost { auth: AuthProvider; backend(session: Session | null): ContentBackend; config: PlatformConfig; componentsUrl: string; mode: 'github' | 'local-disk'; capabilities: { publish: boolean; pageOps: boolean }; sessionStore: SessionStore; navigation: NavigationGuard; urls: { pageUrl(pagePath: string): string | null; commitUrl(sha: string): string | null }; buildSha: string; onSignedIn?(): void }`,
  `NavigationGuard { block(message: string): () => void }`, `SessionStore` (interface that `BrowserSessionStore` implements), `EditablePage { version: 'current'; path: string; title: string; isIndex: boolean }`.
- `services/editor/src/inplace/InPlaceContext.tsx` — replaces `PlatformContext` (`{ host, session, identity, backend, signOut }`).
- `services/editor/src/types/pcss.d.ts` — `declare module '*.pcss' { const css: string; export default css }`.

Modify
- `services/editor/package.json`: name stays `@platform/editor`; remove scripts `dev/build/preview/e2e` (keep `test`); `exports` per Task 1; remove devDeps `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@playwright/test`; add `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language`, `@codemirror/lang-markdown` (Task 5 uses them); keep `tailwindcss`, `tw-animate-css` as devDeps (consumed by the site's PostCSS step).
- `services/editor/tsconfig.json`: drop `"types": ["vite/client"]`, drop `vite.config.ts` from include; keep `paths @/*`, `allowJs` (for `platform.config.js` only if still imported — it should not be after this task; remove from include if unused).
- `src/richtext/createRichTextServices.ts`: `RichTextSession` = `{ host, backend, identity }` (was `platform`); `baseUrl` from `host.config.baseUrl`.
- `src/components/BodyEditor.tsx`: take services from `InPlaceContext`.
- `src/components/LoginGate.tsx` → keep component, rename usage to `SignInDialog` (Task 7) — here only adapt prop `platform` → `host`.
- `src/components/dialogs.test.tsx`, `src/components/BodyEditor.test.tsx`, `createRichTextServices.test.ts`: adapt to `host`.
- Root `package.json`: `"site:build": "npm run build -w @platform/site"`; `typecheck` list unchanged (editor still typechecked).
- `.gitignore`: drop `services/editor/test-results/`, `services/editor/playwright-report/`, `services/editor/e2e/.repo-path`; add `site/test-results/`, `site/playwright-report/`.

Tests: all remaining editor vitest suites green (Markdown round-trip suites untouched).

### Task 5 — Raw mode on CodeMirror 6

Create
- `src/rawtext/RawTextEditor.ts` — seam: `RawTextEditorProps { value: string; readOnly: boolean; ariaLabel: string; onChange(value: string): void }`, `RawTextEditorComponent`.
- `src/rawtext/codemirror/CodeMirrorRawEditor.tsx` — one `EditorView` per mount (`markdown()` language, `history`, default keymap + `indentWithTab`, line wrapping, `EditorView.editable.of(!readOnly)`, theme reading `--ed-*` vars), external `value` changes dispatched only when they differ; `contentAttributes: { 'aria-label': ariaLabel }`.
- `src/rawtext/index.ts` — `export const RawTextEditor: RawTextEditorComponent = CodeMirrorRawEditor`.
- `src/rawtext/codemirror/CodeMirrorRawEditor.test.tsx` (jsdom): mounts, shows value, `onChange` fires on a dispatched transaction, read-only blocks edits, external value update doesn't loop.

### Task 6 — Page look: kit, skin, theme

Create (all additive; existing kits/nodes stay for tests)
- `src/richtext/skin.tsx` — `RichTextSkin { Admonition?: ComponentType<{ type: string; title?: ReactNode; children: ReactNode }> }`, `RichTextSkinProvider`, `useRichTextSkin()` (defaults = `{}`).
- `src/richtext/plate/page/` — `PageHeadingElements.tsx` (h1–h6 plain), `PageParagraphElement.tsx`, `PageBlockquoteElement.tsx`, `PageListElements.tsx`, `PageHrElement.tsx`, `PageTableElements.tsx`, `PageCodeBlockElement.tsx` (`<pre><code>` with lowlight spans, Infima pre styling), `PageCalloutElement.tsx` (uses `skin.Admonition` with `contentEditable={false}` title slot + editable children; falls back to `CalloutElement`), `PageTabsElement.tsx` / `PageTabItemElement.tsx` (Infima `tabs-container`/`tabs`/`tabs__item--active` header with `contentEditable={false}`, inactive items `hidden`, label/value edit on double-click, "Add tab"), `PageViewerElement.tsx` (real viewer core at `height`, gear button → popover with `PropFields`).
- `src/richtext/plate/kits/page-look-kit.tsx` — `withPageLook(plugins)`: maps plugin keys to the page components via `.withComponent(...)` (pure function; unit-test the key→component mapping).
- `src/richtext/plate/kits/page-toolbar-kit.tsx` — same toolbars, `FixedToolbar` sticky at `top: var(--ped-sticky-top)` (navbar + edit bar height set by the host CSS), no `-top-6`.
- `src/richtext/plate/kits/page-editor-kit.tsx` — `PageEditorKit = withPageLook([...ContentKit, CaretSync, BlockSelection, Dnd, Slash, ExitBreak, ...PageToolbarKit])`.
- `src/theme-inpage/inplace.pcss` — `@layer theme, base, components, utilities;` `@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities); @import "tw-animate-css"; @import "./shadcn-variants.css"; @source "../"; @source not inline("container");` dark custom variant on `html[data-theme='dark']`; `@theme inline` (as today); `:root` shadcn vars → `--ed-*`; `--ed-*` → Infima/site vars (`--ed-page: var(--ifm-background-color)`, `--ed-primary: var(--ifm-color-primary)`, `--ed-text: var(--ifm-font-color-base)`, …, no `color-scheme`); scoped Preflight `:where(.ped-ui, .ped-ui *, [data-radix-popper-content-wrapper], [data-radix-popper-content-wrapper] *) { box-sizing:border-box; border:0 solid; }` (+ button/input resets); `.ped-editbar`, `.ped-settings`, `.ped-title-input` chrome rules; `[data-platform-editing] .markdown [data-slate-editor] { outline: none }` and subtle block hover affordances.
- `src/theme-inpage/shadcn-variants.css` (moved from `src/theme/`).
- `src/richtext/plate/page/page-look.test.tsx` — headings render as bare `<h2>` (no Tailwind typography classes), callout uses injected `Admonition` when provided, tabs render Infima classes, okf block read-only.
- `src/inplace/noGlobalCss.test.ts` — walks the import graph from `src/inplace/index.ts` (regex on import specifiers) and fails on any `.css` import.

Modify
- `src/richtext/plate/ui/editor.tsx` — add cva variant `page` (no padding/background/max-width; `min-h` only).
- `src/richtext/plate/PlateDocument.tsx` — `variant` prop (default `'docs'`) instead of the hard-coded value.
- `src/richtext/plate/PlateRichTextEditor.tsx` — passes `PageEditorKit` and `variant="page"`; wraps in `RichTextSkinProvider` only if the host supplies a skin (skin passed via `InPlaceEditor`, not via `RichTextEditorProps` → the `RichTextEditor` interface is unchanged).

Tests: all existing richtext suites (round-trip, fixtures, toolbar, transforms) still green with `EditorKit`; new tests above.

### Task 7 — In-place editor UI (library, `src/inplace/`)

Create
- `index.ts` — exports `InPlaceEditor`, `SavedPreview`, `pendingEdits`, types (`InPlaceHost`, `EditablePage`, `RichTextSkin`, `NavigationGuard`), and `inplaceCss` (`import css from '../theme-inpage/inplace.pcss'`).
- `InPlaceEditor.tsx` — props `{ host, page, skin?, onExit(result: { saved?: { text: string; commitSha: string; regenerated: string[] } }) }`; root `<div className="ped-ui" data-platform-editing>`; flow: verify stored session → `SignInDialog` if none → `readPage` → editing; renders `EditBar`, `ProblemList`, then inside a `div.theme-doc-markdown.markdown`: `InlineTitle`, `PageSettingsPanel` (when open, non-index), `BodyEditor` or `RawTextEditor`.
- `useEditSession.ts` + `editSessionReducer.ts` — states `checking-session | signing-in | loading | editing | saving | conflict | error`; module-level `editSessions` map keyed by page path so an HMR remount restores the draft; exposes `dirty`.
- `composeDocument.ts` — pure: `(original, fields, bodyMarkdown | null, mode, raw)` → full file text (logic moved from old `App.compose`, byte-exact when unedited); `composeDocument.test.ts`.
- `folderIntroGuard.ts` (+ test) — rejects a save whose okf generated block differs from the loaded one.
- `EditBar.tsx` — Visual/Raw segmented control, "Page settings" toggle, `PageActionsMenu`, commit message input, Cancel, Save (`Saving…`), dirty dot "Unsaved changes", status line `role=status data-testid="edit-status"` with commit link (`host.urls.commitUrl`) or "Saved to disk" in dev.
- `PageActionsMenu.tsx` — New page in this folder… / Rename… / Delete… / Publish version… (only `capabilities.publish && identity.role==='editor'`) / Sign out; all disabled while dirty+saving as appropriate; uses `NewPageDialog`, `PublishDialog` (existing), new `RenamePageDialog.tsx`, `DeletePageDialog.tsx` (on `Modal`).
- `SignInDialog.tsx` + `signInPanels.tsx` — registry `{ 'github-token': PatPanel, mock: DisplayNamePanel }` built from `LoginGate`'s current markup; remember defaults to `true`; unknown provider id → clear error.
- `InlineTitle.tsx` — `<header><input aria-label="Page title" class="ped-title-input" /></header>` styled as Infima `h1`, bound to `fields.title`.
- `PageSettingsPanel.tsx` — wraps `FrontmatterForm` (types in use from `backend.listPages('current')`, loaded lazily on first open).
- `useUnsavedGuard.ts` — while dirty: `host.navigation.block(DISCARD_PROMPT)` + `beforeunload`; released on save/cancel.
- `pendingEdits.ts` (+ test) — sessionStorage `docs-platform.pending-edits` `{ [path]: { text, commitSha, buildSha, savedAt } }`; `get(path, currentBuildSha, now)` returns null after buildSha change or 15 min; try/catch around storage.
- `SavedPreview.tsx` — read-only `RichTextEditor` (page look) + banner; used after a live save and for pending edits.
- Tests (jsdom, mock `InPlaceHost` with `MockAuthProvider` + a fake `ContentBackend`): first Edit shows sign-in; remembered session skips it; failed verification forgets + notice; edit + save calls `writePage` with `expectedEtag` and composed text; `CONFLICT` shows conflict state with both actions; `VALIDATION` details shown in `ProblemList`; Cancel when dirty asks, when clean exits silently; guard registers/unregisters `block`; parse error → Raw with message; index page: no settings panel, guard rejects changed okf block; page actions call the right backend methods; publish hidden in `local-disk` mode.

### Task 8 — Site integration

Create
- `site/src/theme/DocItem/Content/index.tsx` (wrap, site element; no editor imports): `const page = useEditablePage()`; idle → `<EditButton/>` + `<Content {...props}/>`; on request → lazy-load (`React.lazy` around the dynamic import, `Suspense` fallback = original content + "Loading editor…"); editing → `<Mounted host page onExit/>`; after a live save or with a pending edit → `SavedPreview` (also lazy). Edit button only after hydration (`useIsBrowser`) and only when `globalData.enabled && page`.
- `site/src/theme/EditThisPage/index.tsx` (wrap): editable page → button "Edit this page" calling `requestEdit()` and scrolling to top; versioned page → `null`; other cases → original.
- `site/src/components/InPlaceEdit/EditButton.tsx`, `editRequest.ts` (module-level emitter shared by the two wrappers), `useEditablePage.ts` (reads `useDoc()`, `usePluginData('platform-inplace-edit')`), `styles.module.css` (button only; tiny).
- `site/src/platform/inplace/pagePath.ts` (+ `pagePath.test.ts`) — `toEditablePage({ source, version, title, permalink })` → `EditablePage | null`: `@site/docs/` prefix → path; non-`current` → null; `log.md`, `code-maps/**`, non-`.md(x)` → null; `isIndex` for `index.md`.
- `site/src/platform/inplace/createInPlaceHost.ts` (+ test) — from `platform.config.js` + global data: `github` → `GithubTokenProvider` + `GithubBrowserBackend(token)`; `local-disk` → `MockAuthProvider` + `HttpContentBackend(endpoint, fetchWithDevToken)` after a successful `ping` (else fall back to github); `capabilities.publish = mode === 'github'`; `urls.pageUrl` via `baseUrl` + route mapping (`index.md` → folder route); `commitUrl` → GitHub URL (github mode) / null; `buildSha` from `siteConfig.customFields.buildSha`; `onSignedIn` → `resetContentBackend()`.
- `site/src/platform/inplace/navigationGuard.ts` — `history.block` adapter.
- `site/src/platform/inplace/skin.tsx` — `{ Admonition: (p) => <Admonition type={p.type} title={p.title}>{p.children}</Admonition> }` from `@theme/Admonition`.
- `site/src/platform/inplace/mountInPlaceEditor.tsx` — default export component: injects/removes `<style data-platform-editor>` (`inplaceCss`) with ref-counting; renders `<InPlaceEditor host page skin onExit/>`; named export `SavedPreview` wrapper.

Modify
- `site/src/platform/createContentBackend.ts` — add `resetContentBackend()` (clears the cache).
- `site/docusaurus.config.js` — remove navbar + footer "Editor" items; plugin options; `customFields: { buildSha: process.env.PLATFORM_BUILD_SHA ?? 'local' }`; keep `editUrl` (provides `metadata.editUrl`, used only as fallback).
- `site/src/css/custom.css` — `--ped-sticky-top: calc(var(--ifm-navbar-height) + <edit bar height>)` only if needed (prefer defining it in `inplace.pcss`).

Tests: `pagePath.test.ts`, `createInPlaceHost.test.ts` (node; Docusaurus modules not imported in those two files — keep them pure); `npm run site:build`; manual `npm run site:start` smoke (edit a page, save → file on disk changes, page hot-reloads, `git status` shows the page + regenerated files + `log.md`, no commit).

### Task 9 — Deploy and leftovers

Modify
- `.github/workflows/deploy-pages.yml` — name "Deploy site to GitHub Pages"; step "Build site" runs `npm run site:build` with `env: PLATFORM_BUILD_SHA: ${{ github.sha }}`; editor build step gone.
- `platform.config.js` comments: `features.editor` = in-place Edit; `baseUrl` comment no longer mentions `<baseUrl>editor/`; `auth.provider` comment mentions dev mode uses mock automatically; `content.backend` comment mentions the dev disk endpoint.
- `packages/contracts/src/platform-config.ts` — doc comments only (type unchanged).

Create
- `site/static/editor/index.html` — meta refresh to `../` + one sentence (D15).

Verify: `git grep -n "copy-editor\|pathname:///editor\|VITE_PLATFORM"` → only `docs/design/**` (historical, untouched).

### Task 10 — Playwright e2e against the Docusaurus site (GitHub API mocked)

Create
- `site/playwright.config.ts` — `testDir: './e2e'`, `workers: 1`, `webServer: { command: 'npm run build && npx docusaurus serve --port 3210 --host 127.0.0.1 --no-open', env: { PLATFORM_BUILD_SHA: 'e2e-build-1' }, port: 3210, timeout: 300_000, reuseExistingServer: !process.env.CI }`, `baseURL: 'http://127.0.0.1:3210/documentation-system/'`.
- `site/e2e/support.ts` — fixture: fail on console errors (as before); per test a fresh `FakeGitHub('RayanYousef','documentation-system')` seeded from the real `site/docs/**`, `site/versions.json`, `site/versioned_docs/**`, `site/static/**` (repo-relative paths `site/...`), composed with the auth fake (`GET /repos/o/r` → push per token, `GET /user`; token `good-token` = writer, `reader-token` = push:false, anything else 401); `page.route('https://api.github.com/**', ...)` forwards to it; `media.githubusercontent.com`/`raw.githubusercontent.com` → 404 fixture-safe; helpers `clickEdit`, `signInWithToken`, `body()`, `save()`, `fileOnMain(path)`.
- Specs (each seeds/edits its own page through FakeGitHub; the served HTML is the build, the editor reads `main` from the fake):
  1. `edit-entry.spec.ts` — Edit button visible on a Latest doc and on a category index; absent on `/1.0.0/...` and on `/log`; footer "Edit this page" triggers the same editor; **bundle check**: collect every JS/CSS response body before clicking Edit → none contains `data-slate-node`/`data-slot="toolbar"`/`--tw-`; no `<style data-platform-editor>`; after click → an `inplace-editor` chunk is requested and the style tag exists; after Cancel → style tag removed.
  2. `sign-in.spec.ts` — first Edit shows the PAT modal; bad token → provider error inline; `reader-token` → NOT_COLLABORATOR message; `good-token` → editor opens; reload + Edit → no modal (remembered); Sign out → next Edit asks again.
  3. `save.spec.ts` — type in the body, set commit message, Save → FakeGitHub `main` has one new commit with that message, the page text, a `log.md` entry and regenerated `manifest.json`; `okf` `validateBundle`/`generateBundle` over the faked tree reports no problems and no stale files; page shows the saved text with the "updates after deploy" banner; reload → pending edit still shown; rewrite the stored entry's `buildSha` to a different value (simulating a newer deploy) or its `savedAt` past the 15 min TTL via `page.evaluate` on sessionStorage → reload → the normal built page is shown again. (buildSha/TTL logic itself is unit-tested in `pendingEdits.test.ts`.)
  4. `cancel-guard.spec.ts` — dirty + Cancel → confirm dismiss keeps editing, accept restores original HTML, no commit; dirty + click a sidebar link → confirm dismiss stays (URL unchanged), accept navigates; dirty + reload → `beforeunload` dialog.
  5. `raw-mode.spec.ts` — Visual → Raw shows frontmatter + body in CodeMirror (`.cm-content`), edit there, back to Visual shows the change, Save commits raw text; a page with unsupported syntax opens in Raw with the fallback message.
  6. `blocks.spec.ts` — page with admonition renders `.theme-admonition` inside the editor, typing inside it saves `:::tip` correctly; Tabs render Infima tabs, switching tabs, editing second tab saves correct JSX; ModelViewer block shows the viewer and prop popover, changing `height` saves the attribute; "/" menu inserts a component; okf block on an index page is read-only.
  7. `conflict.spec.ts` — open Edit, then a commit lands on the same file in FakeGitHub → Save shows the conflict state; "Reload latest" loads the new text; nothing overwritten. Branch-moved-only case (other file changed) → saves successfully after the automatic retry.
  8. `folder-intro.spec.ts` — edit `systems/` intro paragraph, Save → intro changed, generated block regenerated and otherwise identical.
  9. `page-actions.spec.ts` — New page (folder prefilled) → commit with the new file + index/manifest/log; Rename via modal → delete+add in one commit; Delete via modal → commit, navigates to the category; Publish version is visible for a writer in github mode and creates the versioned commit + tag in the fake.
  10. `theme.spec.ts` — dark and light: edit bar, menus, dialogs use the site palette (computed colours equal `--ifm-color-primary` etc.); navbar/sidebar computed styles identical before Edit, during Edit and after Cancel (no leakage); toolbar sticks below the navbar when scrolled.
- `site/package.json` script `"e2e": "playwright test"`.

Local-dev path: covered by Task 3's integration test (real HTTP server + middleware + temp git repo), per requirement.

### Task 11 — Docs, OKF, skill

Modify (keep OKF Core frontmatter: `title`, one-sentence decision-aid `description`, `type`, `tags`, `resource`, `sources` pinned to existing files only)
- `site/docs/platform/editor.md` — rewrite: in-place editing UX, lazy chunk, composition root (`site/src/platform/inplace/`), `InPlaceHost` port, modes (github / local-disk), sign-in, page look + skin, CSS isolation, Raw on CodeMirror, folder intros, page actions, pending edits, tests (vitest list + 10 Playwright specs), known issues. Remove `sources` pointing at deleted files; add the new ones.
- `site/docs/platform/decisions.md` — rows **24** (in-place editing replaces the standalone app; editor becomes a library; one composition root in the site), **25** (dev server saves to disk through a loopback-only, token-guarded middleware without committing), **26** (editor CSS compiled to a string and injected only while editing, never through Docusaurus' global CSS chunk), **27** (versioned pages and generated files are not editable), **28** (Git Data commits name their expected parent; branch-moved saves are retried). Update the description line ("twenty-three" → current count wording).
- `site/docs/platform/architecture.md` (workspace table, composition diagram, lint table, save flow), `site.md` (swizzles, plugin, no Editor link, buildSha), `auth.md` (session default remember-on, where the sign-in lives, dev mode uses mock), `content.md` (Committer, rpc handler, expected parent + retry), `workflows.md` (site:build, e2e location/command, deploy env, ignored paths, copy-editor removed), `contracts.md` (only if wording mentions the editor composition), `extending/add-auth-provider.md` (register a sign-in panel + wire in `createInPlaceHost`), `extending/add-content-backend.md` (wire in `createInPlaceHost`), `extending/add-site-plugin-or-viewer.md` (page-look block + skin), `roadmap.md` (Phase 2 no longer mounts `/editor/`), `getting-started.md`, `agent-skill.md`, `index.md` (only hand-written part).
- `site/docs/log.md` — new `## <date>` section, one `* **Update**: [Title](/path.md) - summary. (by Rayan Yousef)` line per changed page, newest first.
- `README.md` — commands table (`site:build`, `site:start` = edit in place with disk saves, `npm run e2e -w @platform/site`), live line ("click Edit on any page").
- `.agents/skills/docs-platform/SKILL.md`, `references/authoring.md` — editing is in place.
- Run `npm run okf:generate` (manifest, code maps, index blocks), then `npm run okf:check`.

### Task 12 — Final verification and PR

Run the Definition of Done list; capture before/after numbers (initial JS per page, lazy chunk size, build time); commit in logical commits on `feat/inplace-editing`; push; `gh pr create` (body ends with the attribution line from the session). Do not merge.

---

## 4. Test plan summary

| Layer | Where | Covers |
|---|---|---|
| Unit (content) | `services/content/test/*` | rpc handler allow-list/limits/no-CORS, committers, contract suite ×2 committers, Git Data expected-parent + retry race |
| Integration (dev path) | `site/plugins/platform-inplace-edit/devContentMiddleware.test.ts` | loopback/Host/Origin/token/content-type guards, path confinement, no publish, disk write + regeneration, no git commit, conflict |
| Unit (site) | `site/src/platform/inplace/*.test.ts`, `site/plugins/.../mode.test.ts` | source→page mapping, editability rules, host wiring per mode, ping fallback, mode resolution |
| Unit/component (editor) | `services/editor/src/**/*.test.tsx` | CodeMirror raw editor, page-look kit + skin, edit-session reducer, composeDocument byte-exactness, folder-intro guard, pending edits TTL/buildSha, sign-in panels, guard, conflict/validation states, page actions, no-global-CSS import guard; all existing Markdown round-trip suites |
| Lint | `scripts/lint-boundaries.test.ts` | site can't import editor; site-composition and site-plugins can import what they need |
| E2E | `site/e2e/*.spec.ts` (10 specs) | every requirement bullet: Edit visible, first-time login, edit+save commits (mocked GitHub), cancel, raw, component blocks, conflict, unsaved guard, no editor bundle before Edit, folder intro, page actions, theme/no leakage |
| Build | `npm run site:build` | SSR stub works, chunk split, no editor CSS in `styles.css` |
| OKF | `npm run okf:check` | docs + regenerated files consistent; e2e save spec also re-validates the committed tree |

---

## 5. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | Plate/Tailwind 4 don't compile cleanly in Docusaurus webpack (ESM edge cases, `extensionAlias` side effects, babel vs TS syntax, Tailwind 4 output vs Docusaurus' CSS minimizer). | Med / High | Task 1 is a gate with measurable checks. `extensionAlias` falls back to `.js`, so node_modules are unaffected. The editor CSS never goes through Docusaurus' CSS pipeline (asset/source string). **Fallback B** if the gate fails: build `@platform/editor` with Vite in library mode (ESM + its own CSS) into `site/static/platform/editor/` at prebuild and load it with a runtime `import(url)` + `<link>` on Edit (React passed in via a factory to avoid two Reacts). Same `InPlaceHost` contract, so Tasks 2–11 are unchanged. |
| R2 | Style leakage either way: editor CSS restyles the site (Preflight, `--primary`, `.container`, `color-scheme`) or Infima breaks editor chrome (popovers, inputs). | High / Med | D5: no global Preflight, scoped reset, `@source not inline("container")`, shadcn vars mapped to the same Infima values, style tag removed on exit; chrome lives in `.ped-ui` outside `.markdown`, portals covered by the scoped reset; `theme.spec.ts` compares computed navbar/sidebar styles before/during/after edit. |
| R3 | Security of the dev disk endpoint (drive-by writes from a malicious site, LAN access, path traversal). | Low after mitigation / High | D9 guards (loopback socket + Host + Origin + secret token + JSON-only + no CORS + allow-list + `assertPagePath` + size limit), integration tests for each refusal; middleware only exists under `docusaurus start`. |
| R4 | Live save race leaves stale generated files on `main` → deploy's `okf:check` fails (F9). | Med / High | D14 expected-parent commit + bounded retry, race unit test. |
| R5 | Pages latency/CDN: user reloads and sees old content, thinks the save was lost. | High / Med | D8 pending-edit preview with banner + commit link, buildSha/TTL expiry. |
| R6 | Swizzle-wrapping "unsafe" components breaks on a Docusaurus upgrade. | Low / Med | Wrap only (render `@theme-original/*` untouched); e2e `edit-entry.spec.ts` catches regressions; pinned `^3.10`. |
| R7 | HMR remount during dev editing loses the draft, or the save response races HMR. | Med / Low | Module-level `editSessions` store keyed by path; exit edit mode on save success before HMR matters; dev status says "Saved to disk". |
| R8 | Look mismatch (code blocks without Prism title/copy button, heading anchors absent while editing). | Med / Low | Accepted while editing; documented in editor.md "Known minor issues". |
| R9 | `webpack-merge` replaces Docusaurus' own `setupMiddlewares` (error-overlay source maps). | Med / Low | Chain the previous function if present; otherwise document the minor degradation; Task 3 checks it. |
| R10 | Build time/memory grow (Plate in the client compile). | Med / Low | SSR stub keeps Plate out of the server compile; measure in Task 1/12; CI runner has headroom. |
| R11 | PAT UX still clunky for first-time users. | Med / Low | Better panel copy + direct link; OAuth/device flow needs a server (Phase 2) — consciously out of scope. |

---

## 6. Definition of done

- [ ] `npm run typecheck` — no errors.
- [ ] `npm run lint` — no errors; new boundary tests pass (site cannot import `@platform/editor`).
- [ ] `npm test` — all vitest projects pass (content, auth, contracts, okf-core, viewers, editor incl. Markdown round-trips, site, scripts, skill).
- [ ] `npm run okf:check` — passes after `okf:generate`.
- [ ] `npm run site:build` — passes; built output has an `inplace-editor` chunk, initial page JS within ±2% of before, no editor CSS in `assets/css/styles.*.css`, no `site/build/editor/` app (only the redirect `editor/index.html`).
- [ ] `npm run e2e -w @platform/site` — all 10 specs pass, zero console errors.
- [ ] Manual (dev): `npm run site:start` → Edit → display name → edit → Save → file + regenerated files + `log.md` changed on disk, page hot-reloads, `git log` unchanged.
- [ ] Manual (live, by Rayan after merge): Edit on the deployed site with a real PAT → commit on `main`, banner shown, Pages redeploys, `okf-validate` green.
- [ ] `git grep -n "copy-editor\|pathname:///editor\|VITE_PLATFORM\|createPlatform"` → matches only under `docs/design/` (historical spec, untouched).
- [ ] Docs updated (editor.md, decisions 24–28, architecture/site/auth/content/workflows/extending pages, log.md, README, skill refs).
- [ ] One PR from `feat/inplace-editing`, not merged.

---

## 7. Assumptions and items the implementer must verify (not decisions to re-ask)

1. `webpack-merge` keeps array/function semantics as described for `devServer.setupMiddlewares` (verify in Task 3; handling defined in R9).
2. Tailwind 4 `@import "tailwindcss/theme.css" layer(theme)` / `utilities.css` split works with `@tailwindcss/postcss` in a `postcss-loader` chain producing a string (Task 1 gate).
3. `NormalModuleReplacementPlugin` regex matches the resolved request of the dynamic import on Windows and Linux paths (use `[\\/]`).
4. FakeGitHub needs small additions for the e2e (e.g. `GET /repos/o/r/commits/:ref` for publish already exists; tag creation exists) — extend the test helper, not production code.
5. GitHub fine-grained PAT creation URL pre-fill parameters are optional polish; plain link if unsupported.
6. Docusaurus `metadata.source` format is `@site/docs/<path>` for the current version (true for 3.x); `pagePath.test.ts` pins it.
7. Node 22 in CI, Windows locally: tests must not rely on POSIX-only paths (use `path` APIs; e2e path regexes with `[\\/]`).
8. No contract (`packages/contracts`) type changes are needed; if one appears necessary, it must be additive and called out in the PR.
