# Plan: Fix saving, test every editor feature, then add text comments

> [!NOTE]
> **Round 2.** Changed from your notes: S8 now covers any number of tabs, bigger heading-style tab labels (H2 vs H3 tested), and renaming a tab by clicking its name. S7 now has a Comments panel with "Open" and "Resolved" tabs, and a Delete button for resolved comments; resolved comments have no highlight on the page.
> Your round 1 answers are pre-ticked. Needs you: check the ticks and press Approve.

<details>
<summary><b>🔶 AGENTS — click to open. You don't need to read this.</b></summary>

## Agents

Agents run one after another, because Parts A and B touch the same editor files.

- **Agent 1 (Part A: S1–S6).** Objective: sign-in proves the token can write, errors are clear, every editor feature has a passing e2e test, and the bugs those tests find are fixed. Model / effort: sonnet / high (simple coding and tests, per your model rule). If it gets stuck on a hard bug, I re-dispatch that bug to opus / high. Mode: background.
- **Agent 2 (Part B: S7–S9).** Objective: the comment system works on the live site and has e2e tests. Model / effort: opus / high (new design across site, editor and content code). Mode: background.
- **Agent 3 (S10 review).** Objective: an independent code review of Parts A and B, with the defects it finds fixed and tested. Model / effort: opus / high. Mode: background.
- **Agent 4 (S11 merge and live check).** Objective: PRs merged, the Pages deploy green, live checks done. Model / effort: haiku / high (routine). Mode: background.

Each agent follows superpowers:test-driven-development and superpowers:verification-before-completion. Agent 2 also follows ray-building-extensible-apps (contracts first, composition root, extend by adding).

## Files

- Edit `services/content/src/github/gitData.ts` — S2: map a write 403 to a clear "token cannot write" error, and a secondary rate limit to its own message.
- Edit `site/src/platform/inplace/GithubTokenProvider.ts` (or its current path) — S1: a write probe at sign-in.
- Edit `services/editor/src/inplace/SignInDialog.tsx`, `InPlaceEditor.tsx` — S2: show the clear messages and a link to the token setup steps.
- Edit `site/e2e/support.ts` (FakeGitHub) — S3: read-only tokens get 403 on writes.
- Add `site/e2e/*.spec.ts` — S4: new specs per feature.
- Add `site/e2e/live/*.spec.ts`, `site/playwright.live.config.ts`, an `e2e:live` script in `site/package.json` — S6.
- Edit `services/editor/src/inplace/PageActionsMenu.tsx` and the new-page flow — S8: "Feature page" template.
- Add a comments contract, store, GitHub and dev-mode adapters, the comment UI and a site plugin that publishes the comment files — S7, S9. Exact paths are chosen by Agent 2 to match the repo's structure and OKF rules.
- Edit `site/docs/platform/editor.md`, `decisions.md`, `log.md`, and add `site/docs/platform/comments.md` — S5, S9.
- Copy this plan to `docs/design/2026-10-09-editor-fix-and-comments-plan.md` — S1.
- State-changing commands: branches `fix/editor-save-and-tests` and `feat/text-comments`; commits; `git push`; `gh pr create`; `gh pr merge --merge --delete-branch` (only if G1 = A). No force push. Never delete `main` or `gh-pages`. No real token is ever used by any agent.

## Definition of done

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run okf:check`, `npm run site:build` all pass. Expect: no errors.
- [ ] `npm run e2e -w @platform/site`. Expect: every old and new spec passes.
- [ ] Every feature in the S4 table has at least one e2e test that inserts it, saves, reloads and checks both the page and the saved MDX.
- [ ] A read-only token in FakeGitHub is refused at sign-in with the "cannot write" message.
- [ ] `npm run e2e:live` without a token. Expect: it stops with a short message that asks for `GITHUB_TOKEN`.
- [ ] Comment e2e: add, hover shows it, click opens it, reply, resolve (highlight gone, listed under "Resolved"), reopen, delete, a comment inside a non-first tab, an unattached comment after the text changes.
- [ ] Tabs e2e: rename by clicking the label, more than three tabs, Feature page template. Screenshots of H2 and H3 tab labels in light and dark mode are in the report.
- [ ] The Pages deploy succeeds and the live checks in S11 pass.

</details>

## 🟦 Problem, goal, success

**Problem:** On 2026-10-09 a save on the live site failed with `GitHub refused POST /repos/RayanYousef/documentation-system/git/blobs (HTTP 403)`. The code sends the token correctly (`services/content/src/github/gitData.ts:33-35`). A 403 means GitHub accepted the token but refused the write. The likeliest cause is a fine-grained token without "Contents: Read and write". Sign-in did not catch it because it only checks `permissions.push` on `GET /repos/...` (`GithubTokenProvider.ts:25-31`). For a fine-grained token that flag shows your role as owner, not what the token may do. The e2e mock cannot produce this 403 (`site/e2e/support.ts`), so tests passed. Several features have no e2e test at all: formatting toolbar, code blocks, links, images, tables and dev-mode saving. No published page uses Tabs yet, and you plan to use Tabs ("How to use", "API", "Misc") as the main way to organize feature pages. You also want comments on text, like in Adobe Reader.

**Goal:** Saving works with a correctly set up token, every editor feature is proven by e2e tests, and anyone can read comments on text while signed-in editors add, reply to and resolve them.

**Success:** You sign in with a new token, save twice in a row, add Tabs and an FBX model, and they show on the live site after deploy. You select text, add a comment, and a reader in another browser sees the highlight and the comment after the deploy.

## ✅ Verified facts

- Owner and repo are built in from `platform.config.js:17-19`. They match the failing URL.
- Both 401 and 403 map to one `FORBIDDEN` error in `gitData.ts:40`, and save errors show the raw text (`InPlaceEditor.tsx:119`).
- All e2e specs use a mocked GitHub (`site/e2e/support.ts`, `installGitHub`). Run with `npm run e2e -w @platform/site`.
- In the editor, Tabs draw as real tabs (`PageTabsElement.tsx:21`); double-click edits their settings.

## 🟪 Steps

### Part A — fix saving and test everything

<details>
<summary><b>S1 Prove the token can write at sign-in</b></summary>

**What it does:** At sign-in, after the current checks, the editor makes one harmless write: it creates a tiny Git blob with `POST /git/blobs`. A blob is a stored file body that no branch points to, so the repo does not change and GitHub cleans it up later. If GitHub refuses, sign-in fails with: "This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write." The message links to the token setup section in `editor.md`. The plan is copied into `docs/design/`.

**Why:** The broken token passed sign-in and only failed at save time, after you had done the work.

</details>

<details>
<summary><b>S2 ❓ Clear save errors</b> — what you see when a save fails. Question S2.</summary>

**What it does:** `gitData.ts` stops treating 401 and 403 as the same thing. It tells apart: token expired or revoked (401), token cannot write (403 on a write), GitHub rate limit (403 or 429 with rate-limit headers, with the wait time), and branch protection on `main` (403 or 422 with GitHub's "protected branch" text). Each gets a plain message in the editor. Your edits stay on the page after a failed save, so you can retry.

**Why:** "HTTP 403" told you nothing about how to fix it.

**If you skip it:** Save errors keep showing raw HTTP codes.

</details>

<details>
<summary><b>S3 Make the test GitHub mock act like real GitHub</b></summary>

**What it does:** `site/e2e/support.ts` FakeGitHub learns read-only tokens (403 on writes), expired tokens (401), rate limits and a protected branch. New e2e specs check that each one shows the right message, and that the edits survive the failed save.

**Why:** The mock accepted any token, so the real failure could not show up in tests.

**Needs:** S1, S2.

</details>

<details>
<summary><b>S4 An e2e test for every editor feature</b></summary>

**What it does:** Adds Playwright specs so each feature below is inserted, edited, saved, reloaded, and checked both on the page and in the saved MDX text.

| Feature | Covered today |
|---|---|
| Bold, italic, code, headings, lists, quote, undo and redo | no |
| Links (add, edit, remove) | no |
| Code blocks (language, multi-line) | no |
| Images (from URL and upload) | no |
| Tables (add rows and columns) | no |
| Admonitions (each type) | yes, extend |
| Tabs: add, add a tab, rename, reorder, remove, default tab, text and a 3D model inside a tab, save and reload | partial, extend |
| 3D models: GLB upload, FBX upload, pick from repo, change size and settings, inside a tab | partial, extend |
| Raw mode, switch back and forth without losing text | yes, extend |
| New, rename, delete page, publish | yes |
| Sign in, sign out, remember me | yes |
| Two saves in a row within a minute | no |
| Dev-mode saving with `npm start` (writes the file, no commit) | no |

**Why:** You asked for every feature tested end to end. Untested features are where bugs hide.

</details>

<details>
<summary><b>S5 Fix what the tests find</b></summary>

**What it does:** Each failing test from S3 and S4 gets a fix, a commit and a passing re-run. Any hard bug the sonnet agent cannot fix in two tries goes to an opus agent. `editor.md`, `decisions.md` and `log.md` record the fixes. `editor.md` gets a short "Create your token" section with the exact settings.

**Why:** Tests that fail and stay failing do not help you.

**Needs:** S4.

</details>

<details>
<summary><b>S6 A live test you run with your own token</b></summary>

**What it does:** Adds `npm run e2e:live`. It reads `GITHUB_TOKEN` from your terminal, never from a file, and never prints it. It builds the site locally, signs in against real GitHub, and on one test page: saves, saves again within a minute, adds Tabs, adds an FBX model, adds a comment (after Part B), then deletes the test page. Each step is a real commit to `main`, so it also starts a few Pages deploys.

**Why:** Agents must not use your real token. This lets you prove the real GitHub path yourself in one command.

**Needs:** S5.

</details>

### Part B — comments on text

<details>
<summary><b>S7 Comments: how they work</b></summary>

**What it does:** Builds the comment system:

- **Add:** a signed-in editor selects text. A small "Comment" button appears. It opens a box. Save stores the comment.
- **See:** every reader sees the commented text highlighted. Hover shows the comment. Click opens a card with the full thread.
- **Reply and resolve:** the card has Reply and Resolve buttons for signed-in editors.
- **Comments panel:** a "Comments" button on the page opens a side panel with two tabs: "Open" and "Resolved". Resolved comments leave the page: no highlight, no hover card. They live only in the "Resolved" tab, where signed-in editors can Reopen or Delete them. Delete asks "Delete this comment for good?" and removes it from the file (it stays in Git history).
- **Tabs:** a comment on text inside a tab remembers that tab. Each tab label shows a small count of open comments, so you know which tab has notes.
- **Text changes:** a comment remembers its quoted text plus a few words before and after. If an edit removes that text, the comment moves to an "Unattached" group in the "Open" tab of the Comments panel instead of being lost.
- **Storage:** one JSON file per page in the repo. Saving a comment is a commit to `main`, using the same sign-in and retry code as page saves. In dev mode (`npm start`) it writes the file locally.
- **Speed:** you see your new comment right away. Other readers see it after the Pages deploy, about 2–4 minutes.
- **While editing a page:** highlights are hidden, and they come back after save.
- **Frozen versions (1.0.0):** no comments.

**Why:** You want to leave notes on text, like in Adobe Reader, readable by everyone.

**Needs:** S5.

</details>

<details>
<summary><b>S8 ❓ Better tabs and a "Feature page" template</b> — how tabs look and how you make them. Question S8.</summary>

**What it does:**

- **Any number of tabs.** Add, remove and reorder tabs freely; three is only the template's start.
- **Rename a tab by clicking its name** while editing. The name becomes a text box; Enter saves, Escape cancels. No settings dialog needed.
- **Heading-style tab labels.** Tab labels get bigger and bolder, like a heading, on the live site and in the editor. The agent builds both H2 size and H3 size, takes screenshots of each in light and dark mode, and picks H3 unless H2 reads clearly better. The screenshots come to you in the report. Switching later is one CSS value.
- **Template.** "New page" offers "Blank" or "Feature page". The Feature page starts with a title and tabs "How to use", "API" and "Misc", each with a short placeholder line.

**Why:** You will organize feature pages with tabs, so tabs must be easy to read and easy to edit.

**If you skip it:** Tabs keep their current small look, renaming stays in the settings dialog, and you add tabs by hand.

</details>

<details>
<summary><b>S9 Comment tests and docs</b></summary>

**What it does:** Adds e2e specs for adding, hovering, opening, replying, resolving (the highlight disappears and the comment moves to "Resolved"), reopening, deleting a resolved comment, a comment inside a non-first tab, an unattached comment, renaming a tab by clicking it, the Feature page template, a reader who is not signed in (sees them, cannot add), and dev-mode comment saving. Adds `site/docs/platform/comments.md` and updates `decisions.md` and `log.md`.

**Why:** The same "every feature tested end to end" rule applies to comments.

**Needs:** S7.

</details>

### Part C — review, merge, check live

<details>
<summary><b>S10 Independent review</b></summary>

**What it does:** A separate opus agent reviews each part's PR for bugs. Each real defect it finds gets a fix and a test. All checks from the Definition of done re-run.

**Why:** The last review found four real bugs that the builder missed.

**Needs:** S6, S9.

</details>

<details>
<summary><b>S11 ⚠️ ❓ Merge and check the live site</b> — changes `main` and the public site. Question G1.</summary>

**What it does:** Part A ships as one PR, Part B as a second PR. After checks pass, each is merged to `main`, the Pages deploy is watched, and the live site is checked: no console errors, Edit works, sign-in shows the new write check, comments show for a reader who is not signed in, Tabs and 3D viewers render. Merged branches are deleted.

**Why:** You asked for this finished end to end.

**If you skip it:** The PRs wait for you to merge them.

**Needs:** S10.

</details>

## ⬜ Out of scope

- Using your real token in any agent. Only you run `e2e:live`.
- GitHub OAuth sign-in (needs a server). The pasted token stays the sign-in method.
- Comments from people without write access to the repo.
- Email or other notifications for new comments.
- Comments on frozen versions such as 1.0.0.
- Reworking existing doc pages to use the new tabs.
- Splitting the large editor download into smaller parts.

## 🟩 Questions

> [!NOTE]
> Tick one box per question. ★ is my pick. For an answer not listed, write it as a comment on the question. No tick and no comment means no answer.

### 🔹 **Step related**

*Questions tied to one step. Each uses its step's ID.*

**S2 — Clear save errors.** I'd default to doing it — OK?

- [x] A ★ Do it
- [ ] B Skip it

**S8 — Better tabs and template.** I'd default to all four parts, with H3-size labels unless the screenshots show H2 is clearly better — OK?

- [x] A ★ All four parts, H3 by default, screenshots of H2 and H3 in the report
- [ ] B All four parts, always H2
- [ ] C Skip it for now

### 🔹 **General questions**

*Questions not tied to one step.*

**G1 — Merging to main.** I'd default to merging each PR myself once every check passes, then watching the deploy — OK?

- [x] A ★ Merge each PR when green, deploy, check live
- [ ] B Open the PRs and wait for my OK before merging
- [ ] C Skip this step

**G2 — Comment defaults.** I'm assuming — correct me if wrong: a Comments panel with "Open" and "Resolved" tabs; resolved comments have no highlight and can be reopened or deleted; reply threads; one JSON file per page in the repo; changed text moves a comment to an "Unattached" group; highlights hidden while editing.

- [x] A ★ Use these defaults
- [ ] B Change some (write which in a comment)

## 🟥 What could bite you

> [!CAUTION]
> Every saved comment, like every page save, is a commit to `main`, and each commit starts a Pages deploy. Ten comments in a few minutes means ten deploys queued. The site stays up, but new comments reach other readers only when the latest deploy finishes.

- Comments are public in the repo and on the site → accepted, you chose "Everyone sees them".
- A heavy edit can detach many comments at once → they go to "Unattached comments", never deleted.

## 🟧 You'll need to

> [!IMPORTANT]
> These are jobs for you, not for the agents.

- [ ] Revoke the token you pasted in chat: GitHub → Settings → Developer settings → Fine-grained tokens → Delete. It is saved in this chat's history.
- [ ] Create a new fine-grained token: Repository access → "Only select repositories" → `documentation-system`. Repository permissions → **Contents: Read and write**. Metadata (read) is added by itself.
- [ ] After Part A merges, run the live test in your own terminal, in two separate commands: `$env:GITHUB_TOKEN = "<your new token>"`, then `npm run e2e:live -w @platform/site`.
- [ ] Try it yourself on the live site: save twice, add Tabs and an FBX model, add a comment, open the page in a private window and check the comment shows.

## 🟨 Not known yet

> [!WARNING]
> Untested or unverified.

- ⚠️ The 403 cause is not confirmed. A token without Contents write is the likeliest cause; a GitHub rate limit is possible. Your new token plus S1 will show which.
- ⚠️ Whether a tiny blob write is the best sign-in probe was not tested against real GitHub; agents only test it against the mock.
- ⚠️ How the highlight looks in Safari and Firefox is not tested; e2e runs in Chromium only.
- ⚠️ The comments' deploy delay of 2–4 minutes is from past deploy times, not measured for comment files.
