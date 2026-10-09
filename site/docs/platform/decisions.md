---
title: Platform decisions
description: Summarises the twenty design decisions recorded in section 7 of the specification (viewers package, TS contracts over OpenAPI, in-memory okf-core, composition roots, sample repo layout, frozen 1.0.0, code maps, two search indexes, and more) with the reason for each, plus later decisions such as Plate replacing MDXEditor, in-place editing replacing the standalone editor app and how comments are stored and shown; read it before reopening any of them.
type: decision
tags: [platform, decisions, adr, design]
resource: https://github.com/RayanYousef/documentation-system/blob/main/docs/design/2026-09-06-documentation-platform-design.md
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/eslint.config.js
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/platform.config.js
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/versions.json
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/docs/design/2026-10-09-inplace-editing-plan.md
sidebar_position: 13
---

Section 7 of the design specification records decisions that were not in the original brief. They are summarised here with their consequences; the numbering matches the spec.

| # | Decision | Why |
|---|---|---|
| 1 | `packages/viewers` holds the three.js and model-viewer rendering cores. | The site (wrapped with `BrowserOnly` and asset resolution) and the editor (live previews) both need them, and the editor may not import site code. |
| 2 | TypeScript interfaces, not OpenAPI, are the Phase 1 contract. | There is no public HTTP surface yet; OpenAPI is derived from the interfaces in Phase 2. |
| 3 | okf-core operates on an in-memory file map; Node I/O lives in a separate `node` entry. | The browser backend must regenerate indexes, manifest and code maps before every commit. |
| 4 | `HttpContentBackend` and `serveContentBackend` ship in Phase 1. | The e2e needs the editor to reach a `LocalFolderBackend`; they are the seed of the Phase 2 server backend. |
| 5 | `MockAuthProvider` exists. | Tests and the e2e need a provider with no network. |
| 6 | Composition roots (`site/src/platform/`; originally also `services/editor/src/composition/`, removed by decision 24) are the only places that import service implementations. | Everything else sees contract types; substitution is a one-line change. |
| 7 | The sample code repo lives at `examples/unity-project/` in this repository, declared with `pathPrefix`; resource URLs point here; stub source files exist for every cited path; placeholder FBX files were replaced with real meshes. | Every `resource` resolves on GitHub and every viewer renders. |
| 8 | The demo's deliberate broken link was fixed. | CI must be green; the broken-link rule is covered by a unit test fixture instead. |
| 9 | Frozen `1.0.0` stays partial (root index, `systems/index.md`, `systems/inventory.md`) with a README explaining it; its pins use a real sha. | It demonstrates freezing without duplicating the whole demo bundle. |
| 10 | `versions/<v>.json` keeps the profile's `pins` map and adds `refs` (branch labels). | The addition is additive; profile consumers still read `pins`. |
| 11 | Code maps live in the reserved generated folder `code-maps/` inside the bundle. | A platform extension to the profile; documented as generated in `AGENTS.md`. |
| 12 | Log completeness is guaranteed by the write path; the validator checks format and order only. | The log is append-only generated, so re-deriving it from git history would add cost without adding truth. |
| 13 | Two Orama indexes: the Docusaurus plugin's for the site UI and the one `ContentBackend.search` builds with `buildSearchIndex` (the site prebuild also writes it to `static/platform/search-index-<version>.json`, which no backend reads yet). | The plugin index is not addressable from the contract; the second one is. |
| 14 | The editor edits frontmatter through the `yaml` package's document API; okf-core keeps its own zero-dependency YAML subset parser for validation. | Editing must preserve comments, quoting and scalar types; validation must stay dependency-free. |
| 15 | Viewers are global MDX components; the editor writes no import lines (first through MDXEditor descriptors with no `source`, now through the Plate component rules, see decision 23). | Pages stay plain Markdown with components. |
| 16 | Asset fetches read `raw.githubusercontent.com` first and follow a Git LFS pointer (or a refusal) to `media.githubusercontent.com`, cached with the Cache API. (Originally media first; changed because media answers 404 for files not in LFS, a console error on every page with a viewer.) | The media endpoint serves real bytes for Git LFS pointers. |
| 17 | `log.md`, `AGENTS.md`, `README.md` and `code-maps/` are never edited by hand; folder intros are edited in place with the generated block read-only and a save that changes it refused (originally a dedicated view in the standalone editor's file picker). | Generated content can never be hand-edited from the UI. |
| 18 | Node 22 in CI; `engines.node` stays at 20 or newer. | Current LTS in CI without forcing local upgrades. |
| 19 | `scripts/build-site.ps1` and `scripts/start-site.ps1` were replaced by root npm scripts. | One command set on every platform. |
| 20 | The platform skill is committed at `.agents/skills/docs-platform/`; installing it elsewhere means copying the folder. | Documented, not automated, until the skill stabilises. |

Two decisions made while adding this platform documentation follow the same spirit and are recorded here rather than in the spec:

| # | Decision | Why |
|---|---|---|
| 21 | The platform is documented as a folder of the same OKF bundle (`site/docs/platform/`), not as a second bundle. | One manifest, one code map and one generator run cover project docs and platform docs; agents navigate both through the same index. |
| 22 | `codeRepos` keeps a single entry for this repository even though it now hosts both the sample Unity project and the platform code. | Code maps and pins are keyed by `owner/repo`, so one entry already covers every path; a second entry would be a duplicate key with no extra coverage, and `pathPrefix` is only the editor's default for new pages. |

A later decision about the editor, also recorded here rather than in the spec:

| # | Decision | Why |
|---|---|---|
| 23 | Plate replaces MDXEditor for the page body, behind the editor's own `RichTextEditor` interface (`services/editor/src/richtext/`). | Plate gives a better look (Tailwind and shadcn styled with the arcade tokens) and more features (a "/" menu, a floating toolbar over a selection, block drag handles). It is MIT licensed, and only its free parts are used. Pages stay plain Markdown with globally registered components, and a page the editor cannot write back safely opens in Raw mode. Because the app only knows the interface, a later editor, or a move to a database format, is a new implementation next to `plate/`, not a rewrite of the app. |

Decisions made when editing moved into the pages (plan: `docs/design/2026-10-09-inplace-editing-plan.md`):

| # | Decision | Why |
|---|---|---|
| 24 | In-place editing replaces the standalone `/editor/` app. `services/editor` becomes a library (`@platform/editor/inplace`), loaded lazily by the site on Edit, and the site's `site/src/platform/inplace/` is its one composition root. `/editor/` redirects to the docs. | Editors edit what readers see, with the same layout and theme; one bundler and one build; readers download no editor code, and lint keeps reader code from importing the editor. |
| 25 | On `npm start`, saves go to a dev-server-only, same-origin endpoint that writes the working tree without committing (`WorkingTreeCommitter`), guarded by loopback address, loopback Host, same Origin, JSON only, a per-process token and a method allow-list without `publishVersion`. | Instant feedback through hot reload, no token needed locally, no surprise commits on a feature branch, and nothing another website or machine can reach. |
| 26 | The editor stylesheet is compiled to a string and injected only while editing, never through Docusaurus' global CSS chunk; there is no global Preflight and every colour maps onto Infima variables. | Docusaurus merges every CSS import into the one stylesheet all readers download; scoping keeps the site chrome unchanged while editing and after. |
| 27 | Frozen versions and generated files (`log.md`, `code-maps/`) have no Edit button; frozen pages lose the footer edit link too. | Editing a frozen version would break its freeze; generated files are rewritten by every save. |
| 28 | Git Data commits name their expected parent; a save that finds the branch moved re-reads, re-checks the etag and re-plans up to twice, then reports a conflict. | Two near-simultaneous saves could otherwise leave stale generated files on `main` and fail the deploy's `okf:check`. |
| 29 | Sign-in proves the token can write with one harmless `POST /git/blobs` (an unreferenced blob), and `ContentError` and `AuthError` carry plain-language causes (expired, cannot write, rate limited with the wait, protected branch). | For a fine-grained token `permissions.push` is the user's role, so a token without Contents: write passed sign-in and failed at the first save with "HTTP 403". Failing at sign-in, in words that name the fix, costs nothing; a lost connection is never reported as "cannot write". |
| 30 | A save that fails leaves the edits on the page; uploads that the deploy has not published are read from GitHub when the site answers 404. | Retrying must never lose work, and a reload between a save and the deploy must not show broken pictures and viewers. |

Decisions made when comments were added (plan: `docs/design/2026-10-09-editor-fix-and-comments-plan.md`, Part B):

| # | Decision | Why |
|---|---|---|
| 31 | Comments are one JSON file per Latest page in `site/comments/<page>.json`, outside the OKF bundle, changed through a new `CommentStore` contract; every action is one commit to `main` with the same expected-parent retry and plain errors as page saves, and the dev server writes the file through its guarded endpoint. | No server and no database: comments are public, reviewable and versioned like the docs, the bundle's generator and validator never see them, and the sign-in, permissions and failure messages editors already know apply unchanged. |
| 32 | Readers get comments from static files the `platform-comments` plugin writes into the build (one per Latest page, empty when none, fetched after the page shows with `?v=<buildSha>`), never from the GitHub API; the author's own change is kept in the tab until a newer build is served. | Anonymous GitHub API calls are rate limited (60 an hour per address) and would fail for busy readers; static files are free, cached and work for everyone, and the pending copy hides the deploy delay from the author. |
| 33 | A comment points at its text with a text quote (the exact text, 32 characters before and after, and its tab), not a DOM path or a Markdown offset; when the quote is gone the comment is listed as Unattached, never deleted. Highlights use the CSS Custom Highlight API with hit-testing, never wrapping the text in elements. | Quotes survive edits around them and work on the built page and on the editor's saved preview alike; React owns the page's DOM, and changing it would break hydration and the editor's own rendering. |
| 34 | Comments are their own service (`@platform/comments`, contracts only) behind a `CommentsHost` port; the site's composition root supplies the published file, the editor's sign-in (`@platform/editor/signin`, a lazy chunk) and the store, and one session store per tab is shared with the editor. | Extend by adding: the editor is unchanged except for exporting its dialog, readers load a small chunk without the editor, and one sign-in serves editing and commenting. |
| 35 | In the visual editor a click on the shown tab renames it in place and header chips move, remove and configure the shown tab; double-click no longer opens the tab's props. Tab labels use a heading size set by one CSS value; H3 (1.5rem) was chosen over H2 (2rem) after comparing both in light and dark mode. | Renaming and reordering tabs without Raw makes tabs the everyday way to organise feature pages; H2-size labels competed with the page's own section headings, H3 reads as a heading without shouting. |
