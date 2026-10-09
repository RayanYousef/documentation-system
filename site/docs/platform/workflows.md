---
title: Workflows and scripts
description: Lists the GitHub Actions workflows (validate on every push, deploy Pages on main) and the root npm scripts with what each one runs; open it when CI fails, when reproducing CI locally, or when adding a build step or deploy target.
type: system
tags: [platform, ci, github-actions, deploy, scripts, testing]
resource: https://github.com/RayanYousef/documentation-system/blob/main/.github/workflows
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/.github/workflows/okf-validate.yml
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/.github/workflows/deploy-pages.yml
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/package.json
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/scripts/okf.mjs
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/scripts/lint-boundaries.test.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/vitest.workspace.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/scripts/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/contracts/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/okf-core/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/viewers/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/auth/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/editor/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/playwright.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/.agents/skills/docs-platform/vitest.config.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/.gitattributes
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/.gitignore
sidebar_position: 10
---

## GitHub Actions

| Workflow | Trigger | Steps |
|---|---|---|
| `okf-validate.yml` | every push and pull request | `npm ci`; build `contracts`, `okf-core`, `viewers`, `auth`, `content`; `npm run okf:check` (validator and stale check over Latest and every frozen version); `npm run lint`; `npm test` |
| `deploy-pages.yml` | push to `main`, manual dispatch | same install and build; `npm run okf:check`; `npm run site:build` with `PLATFORM_BUILD_SHA` set to the commit (in-place editing uses it to retire its pending previews); publish `site/build` to `gh-pages` with `peaceiris/actions-gh-pages` (concurrency group `deploy-pages`, `contents: write`) |

Both run on Node 22 (`engines.node` stays at 20 or newer). The site is served from the `gh-pages` branch at `https://RayanYousef.github.io/documentation-system/`; editing happens on the pages themselves (the old `/editor/` URL redirects to the docs). The repository is public so Pages can serve it; the spec (section 4.9) records the `gh` commands used to change visibility and enable Pages.

## Root npm scripts

| Script | Runs |
|---|---|
| `npm run okf:generate` | `node scripts/okf.mjs generate`: index blocks, `manifest.json`, code maps and validation for `site/docs` and every `site/versioned_docs/version-<v>`, with `--repo` for each `codeRepos` entry |
| `npm run okf:check` | the same in check mode; exit 1 on any problem or stale generated file |
| `npm run build` | `build` in every workspace that has one (`tsc -b` for packages and services, Docusaurus for the site; the editor library has no build of its own) |
| `npm run typecheck` | `tsc -b` over contracts, okf-core, viewers, auth, content and editor, then `tsc -p site/tsconfig.json` (the site, including the editor sources it compiles) |
| `npm run lint` | `eslint .` including the boundary rules |
| `npm test` | `vitest run` over the workspace list in `vitest.workspace.ts` (every package, service, the site scripts, the root scripts and the agent skill) |
| `npm run site:build` | build the site (prebuild artifacts included; the editor is a lazy chunk of it) |
| `npm run site:start` | Docusaurus dev server; Edit saves to `site/docs` on disk without committing |

Each project's `vitest.config.ts` sets a unique `name` and its own `include` glob, so a new test must live where its project looks for it:

| Project name | Include glob | Environment |
|---|---|---|
| `contracts` | `src/**/*.test.ts` | node |
| `okf-core`, `auth`, `content` | `test/**/*.test.ts` (`content` raises test and hook timeouts to 30000 ms) | node |
| `viewers` | `test/**/*.test.tsx` | jsdom |
| `editor` | `src/**/*.test.{ts,tsx}` | jsdom |
| `site` | `scripts/**/*.test.ts`, `plugins/**/*.test.ts`, `src/**/*.test.ts` (inside `site/`) | node |
| `root-scripts` | `scripts/**/*.test.ts` (repo root) | node |
| `docs-platform-skill` | `test/**/*.test.ts` | node |

`scripts/vitest.config.ts` sets `root` explicitly to the repo root, because Vitest resolves `root` against `process.cwd()`; a new root-level test config must anchor it the same way.

Workspace-level extra: `npm run e2e -w @platform/site` runs the Playwright suite in `site/e2e` against the built site (it builds it and serves it on port 3210, with GitHub mocked in the browser; not part of `npm test`). Install the browser once with `npx playwright install chromium`.

## Root scripts folder

- `scripts/okf.mjs`: the generator entry described above.
- `scripts/lint-boundaries.test.ts` with `scripts/lint-fixtures/`: boots ESLint programmatically on a fixture tree that mirrors the real layout (a `services/auth` file importing `@platform/content`, a theme component importing the editor) and expects the boundary error, while the site composition root and site plugins pass, so a change to `eslint.config.js` that loosens the rule fails the test.

## Reproducing CI locally

```bash
npm ci
npm run build -w @platform/contracts -w @platform/okf-core -w @platform/viewers -w @platform/auth -w @platform/content
npm run okf:check
npm run lint
npm test
npm run site:build
npm run e2e -w @platform/site
```

## Repository hygiene

- Line endings: `.gitattributes` sets `* text=auto eol=lf`, so every text file is LF in the repository and the working tree, whatever `core.autocrlf` says. A CRLF checkout on Windows made `okf:check` report stale generated content and broke `vite-node` on `.mjs` files. Binary types (`fbx`, `glb`, `bin`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `ico`, `woff`, `woff2`, `ttf`, `otf`, `pdf`, `zip`) are marked `binary` and never normalised; a new binary asset type needs its own `*.ext binary` line.
- Ignored paths (`.gitignore`): `.ignored/` (local scratch, never pushed), `*.log`, `node_modules/`, `dist/`, `build/`, `.docusaurus/`, `site/static/platform/`, `site/test-results/`, `site/playwright-report/` and `*.tsbuildinfo`.
- `dist/` is not committed and the package exports point at it, so on a fresh clone run the package builds (see above) before `okf:check`, `lint` or `npm test`.

Adding a deploy target means adding a workflow (or a job) that consumes `site/build` and, in Phase 2, the server image; see [Add a deploy target](extending/add-deploy-target.md).
