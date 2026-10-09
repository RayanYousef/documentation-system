---
title: Content service
description: Describes the three ContentBackend implementations (local folder, GitHub-in-browser, HTTP bridge), the shared write and publish pipelines, the LFS-aware asset fetch and the Orama search; open it when a save, publish or asset load misbehaves or when you are writing a new backend.
type: system
tags: [platform, content, github, git-data, publish, assets, search]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/writePipeline.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/publishPipeline.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/layout.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/local/LocalFolderBackend.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/github/GithubBrowserBackend.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/github/gitData.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/http/HttpContentBackend.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/http/serveContentBackend.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/assets/getAsset.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/search/index.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/local/committer.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/http/contentRpcHandler.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/comments/GithubCommentStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/local/LocalCommentStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/http/commentRpcHandler.ts
sidebar_position: 5
---

`@platform/content` holds every `ContentBackend` implementation and the code they share. It imports `@platform/contracts` and `@platform/okf-core` only. Two entries: the default entry is browser-safe; `@platform/content/node` (`src/node.ts`) adds `LocalFolderBackend`, the git helpers and `serveContentBackend`.

## Shared layout and pipelines

- `layout.ts`: `versionDir(version)` maps `current` to `docs` and `<v>` to `versioned_docs/version-<v>`; `isFrozen`; `STATIC_DIR = 'static'`; `ASSET_DIRS = ['models', 'uploads', 'img']`; `assetKind(path)`; `assertPagePath` (bundle-relative, `.md`/`.mdx`, no dot segments).
- `writePipeline.ts`: `planPageChanges(files, changes, ctx)` is pure. It applies the changes to the in-memory bundle, validates each concept page with `validatePage` (throws `VALIDATION` with the problem list), runs `generateBundle` (throws `VALIDATION` if the bundle no longer validates), collects `regenerated` paths, and prepends `log.md` entries (`Add` when the file did not exist, `Update` otherwise; author and message from `ctx`). `contentEtag(text)` is an FNV-1a digest that works in browsers and Node.
- `publishPipeline.ts`: `planPublish(latest, version, versionsJson, codeRepos, pins, frozenAt)` validates the version label (`MAJOR.MINOR.PATCH`, must not exist), rewrites refs to the resolved sha for every declared repo, regenerates the snapshot, and returns the writes for `versioned_docs/version-<v>/`, `docs/versions/<v>.json` (`pins` per the profile, `refs` recording the branch label), `versioned_sidebars/version-<v>-sidebars.json`, `versions.json` and the tag name `docs-v<v>`.

Every backend follows the same write rules: reject frozen versions with `FROZEN`, run the pipeline, write the page plus every regenerated file in one commit under the editor's identity, and return `CONFLICT` when `expectedEtag` no longer matches.

## Implementations

| Class | Id | Runs in | Storage |
|---|---|---|---|
| `LocalFolderBackend({ siteDir, codeRepos, resolveRef?, committer? })` | `local-folder` | Node | filesystem, then the `Committer`: `GitCommitter` (default, `git` CLI commits with `--author`) or `WorkingTreeCommitter` (writes only, no commit; `publishVersion` is refused with `FORBIDDEN`), which the dev server's disk endpoint uses. `resolveRef` defaults to an unauthenticated `GET /repos/{o}/{r}/commits/{ref}` and tests inject a stub. |
| `GithubBrowserBackend({ owner, repo, branch, sitePath, codeRepos, token, fetch?, apiRoot? })` | `github-browser` | browser | Git Data API. Reads fetch the recursive tree once and blobs by sha (cached in memory by sha); every write is blobs, a tree with `base_tree`, a commit with `author` whose parent is the snapshot the change was planned from (`expectedParent`), then `PATCH refs/heads/<branch>` without force, so multi-file commits are atomic. A rejected ref update (the branch moved) becomes `CONFLICT` with `details.reason = 'branch-moved'`, and writes, creates, deletes and renames start over from a new snapshot (etag re-checked, files re-planned) at most twice; an asset upload is simply retried. The branch ref is read with `cache: 'no-store'`: GitHub sends `max-age=60` and a browser would otherwise serve a ref up to a minute old (a page loaded as it was before the last save, and every retry planned on the same stale head). Tags via `POST /git/refs`. |
| `HttpContentBackend(baseUrl, fetch?)` | `http` | browser | JSON over `POST <baseUrl>/rpc` with `{ method, args }`; errors come back as `{ error: { code, message, details } }` and are re-thrown as `ContentError`. The server side is `createContentRpcHandler(backend, { allow?, maxBodyBytes? })`: the transport only (method allow-list, 25 MB body limit, no CORS headers). `serveContentBackend(backend, { port, host })` wraps it on its own port with open CORS (tools and tests only); the dev server's disk endpoint wraps it behind loopback, Host, Origin and token checks. |

`GithubBrowserBackend` is what the live site and editor use (`content.backend: 'github-browser'` in `platform.config.js`). In-place editing on `npm start` uses `HttpContentBackend` against the dev server's same-origin endpoint; in Phase 2 it becomes the client of the server-side backend that holds the GitHub token as a secret.

## Comment stores

The same package holds the `CommentStore` implementations ([Comments](comments.md)); the browser ones are exported from `@platform/content/comments`, so a page that only needs comments does not load the docs pipeline and search. `src/comments/commentsFile.ts` maps a page to `comments/<page>.json` (after `assertPagePath`), checks a file (`assertCommentsFile`) and writes it as two-space JSON with a final newline.

| Class | Id | Runs in | Storage |
|---|---|---|---|
| `GithubCommentStore({ owner, repo, branch, sitePath, token, fetch?, apiRoot? })` | `github-comments` | browser | the file in the tree of `branch`, etag = blob sha; a write is one Git Data commit with the expected parent, recomputed on `branch-moved` at most twice, refusals mapped by `apiErrors.ts` like page saves |
| `LocalCommentStore({ siteDir, committer? })` | `local-comments` | Node | `<siteDir>/comments/`, etag = `contentEtag`, writes one at a time, then the `Committer` (the dev server passes `WorkingTreeCommitter`) |
| `HttpCommentStore(baseUrl, fetch?)` | `http-comments` | browser | `POST <baseUrl>/comments` with `{ method: 'read' or 'write', args }`; the server side is `createCommentRpcHandler(store, { maxBodyBytes? })` (1 MB, transport only), mounted by the dev server's endpoint |

## Assets

`fetchAsset(ref, { token?, fetch?, cache? })` in `src/assets/getAsset.ts` builds two URLs from `AssetRef { repo, ref, path }`: `raw.githubusercontent.com` first, and `media.githubusercontent.com` (which serves the real bytes) only when raw returns a Git LFS pointer or refuses. Reading media first logged a 404 on every page with a viewer of a non-LFS file. A token adds `Authorization: token ...`. Responses are cached in the Cache API store `docs-platform-assets` (immutable for a 40-hex sha, ten-minute TTL for a branch); `MAX_ASSET_BYTES` is 100 MB and larger files throw `TOO_LARGE`.

`uploadAsset` is a backend method, not part of `fetchAsset`. It writes to `static/<path>` after `assertAssetPath` (plain POSIX segments, no `..`, dot-files, backslashes or drive letters), and returns an `AssetInfo`. Page paths go through `assertPagePath` and version ids through `versionDir`, all throwing `VALIDATION`. `listAssets` only reports files under `static/models`, `static/uploads` and `static/img`, so keep uploads inside those folders or they will not be listed.

## Search

`buildSearchIndex(files)` in `src/search/index.ts` creates an Orama index over every concept page (path, title, description, type, tags, first 2,000 body characters) and returns its serialised form; `searchRaw(raw, query)` loads it and returns up to 20 `SearchHit`s. Each backend's `search` builds that Orama index in memory with `buildSearchIndex` over the version's bundle, caches it (per version for `LocalFolderBackend`, per `version@treeSha` for `GithubBrowserBackend`; `HttpContentBackend` forwards the call to the server backend) and queries it with `searchRaw`. The site prebuild also writes `static/platform/search-index-<version>.json` with the same function, but no backend reads that file yet. The site's search box uses the separate `@orama/plugin-docusaurus-v3` index (decision 13 in [Decisions](decisions.md)).

## Tests

`test/LocalFolderBackend.test.ts` runs the contract suite against a temporary git repository; `test/GithubBrowserBackend.test.ts` runs it against `test/FakeGitHub.ts`, an in-memory implementation of the Git Data, Contents, repos and user endpoints; `test/HttpContentBackend.test.ts` runs it through `serveContentBackend` over a `LocalFolderBackend`; `test/committer.test.ts` runs it again with `WorkingTreeCommitter`. `test/GithubBrowserBackend.race.test.ts` lands a commit between snapshot and commit and checks that the generated files on `main` cover both changes; `test/contentRpcHandler.test.ts` covers the allow-list, the body limit, error mapping and the absence of CORS headers. `test/commentStores.test.ts` runs the comment store contract against `GithubCommentStore` (FakeGitHub), `LocalCommentStore` (with and without commits) and `HttpCommentStore`, plus a branch-moved race and the comment RPC refusals. Pipeline and asset tests are unit tests.
