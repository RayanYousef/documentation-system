# Authoring

## Add or update a page (local bundle)

1. Create or edit `<sitePath>/docs/<folder>/<slug>.md` with frontmatter: `title`, `description` (one sentence, decision aid), `type`, `tags` (list), `resource` (blob URL in a declared repo), optional `sources` (`- resource: <url>` entries), `sidebar_position`. Body in Markdown/MDX; `<ModelViewer>`, `<FbxViewer>`, `<Tabs>`, `<TabItem>` are available without imports.
2. New folder: add `<folder>/index.md` with only `title` and `sidebar_position` frontmatter plus an intro paragraph. The generator adds the markers and the block.
3. From the repository root: `npm run okf:generate` (writes index blocks, manifest, code maps, validates). Exit 1 means fix the report; `manifest.json` is not written until clean.
4. Add a `log.md` bullet under today's date (newest first): `* **Add|Update**: [Title](/folder/slug.md) - what changed. (by Name)`. The editor and content service do this automatically; when editing files directly, do it by hand.
5. `npm run okf:check` must exit 0; commit docs and generated files together.

## Editing in place

Every Latest page of the site has an **Edit** button (and the footer's "Edit this page"). On the live site, the first Edit asks for a fine-grained GitHub token with Contents: Read and write on the docs repo (write collaborators only); Save commits the page and every regenerated file in one commit on the deploy branch under your name, and the page shows the saved version until the deploy finishes. On `npm start`, Edit asks for a display name and Save writes the files to disk without committing (commit them with git). "New page in this folder", "Rename", "Delete", "Publish version" (live site only) and "Sign out" are in the edit bar's Page actions menu. Frozen versions and generated files (`log.md`, `code-maps/`) cannot be edited.

## Remote bundles (kind: content-service)

Read `${tokenEnv}` from the environment and call the content service: `POST <url>/rpc` with `{"method":"readPage","args":["current","systems/inventory.md"]}` (methods: listVersions, listPages, readPage, writePage, createPage, deletePage, renamePage, listAssets, search, publishVersion). Writes need `{"message": "...", "author": {"name": "...", "email": "..."}}` as the last argument. Errors come back as `{"error": {"code": "VALIDATION", "message": "...", "details": [...]}}`; fix the listed problems and retry. Failures from the backend come back as HTTP 200 with an `error` body, so always check the body for `error` instead of the status (a method that is not served returns 403 `FORBIDDEN`). The hosted content service is Phase 2: in Phase 1 only local tools exist (`serveContentBackend` on localhost with no auth, and the Docusaurus dev server's own endpoint, which only its pages can call), and the token header is not defined yet.

## Publishing a frozen version

On the live site: Edit, then Page actions -> "Publish version..." -> enter `MAJOR.MINOR.PATCH`. Or content service: `publishVersion("1.2.0", {message, author})`. Result: `versioned_docs/version-1.2.0/` with every resource pinned to a commit sha, `docs/versions/1.2.0.json`, `versions.json` updated, tag `docs-v1.2.0`.
