---
title: Comments
description: "Explains comments on the text of Latest docs pages (highlights for every reader, hover and thread cards, the Comments panel with Open, Unattached and Resolved, replies, resolve, reopen and delete, comments inside tabs), where they are stored (one JSON file per page under site/comments, committed to main), how readers get them without the GitHub API, how a comment finds its text again, and how it is tested; open it when changing comments or when a comment shows in the wrong place."
type: system
tags: [platform, comments, annotations, highlights, tabs, editor, github]
resource: https://github.com/RayanYousef/documentation-system/blob/main/services/comments
sources:
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/contracts/src/comments.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/packages/contracts/src/testing/commentStoreContract.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/comments/src/ui/CommentsLayer.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/comments/src/anchor/anchor.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/comments/src/model/changeComments.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/comments/GithubCommentStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/services/content/src/local/LocalCommentStore.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/platform/comments/createCommentsHost.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/platform/comments/commentSession.ts
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/plugins/platform-comments/index.mjs
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/src/theme/Tabs/index.tsx
  - resource: https://github.com/RayanYousef/documentation-system/blob/main/site/e2e/comments.spec.ts
sidebar_position: 7
---

Anyone reading a Latest docs page sees the comments on its text, like notes in a PDF reader. Signed-in editors add them by selecting text. Each page keeps its comments in one JSON file in the repository, so they are public, versioned with Git and need no server. This page is a feature page: the tabs below say how to use comments, how they are built, and the rest.

<Tabs>
  <TabItem value="how-to-use" label="How to use" default>
    **See comments.** Commented text has a yellow highlight. Point at it to see the comment; click it to open the whole thread: who wrote it (their GitHub login), when, the text and every reply. The **Comments** button above the page (next to **Edit**) shows how many comments are open and opens the Comments panel.

    **The Comments panel** has two tabs. **Open** lists the comments in page order; click one to jump to its text. Below them, **Unattached** lists comments whose text was changed or removed by an edit: they are never lost, and you can still reply to them or resolve them there. **Resolved** lists resolved comments; they have no highlight on the page.

    **Add a comment.** Select some text on the page. A small **Comment** button appears under the selection; click it, write the comment and press **Save**. If you are not signed in, the button says **Sign in to comment** and opens the same sign-in dialog as **Edit** (one sign-in serves both).

    **Reply, resolve, reopen, delete.** Signed-in editors see **Reply** and **Resolve** on a thread. In the Resolved tab they can **Reopen** a comment or **Delete** it; Delete asks "Delete this comment for good?" and then removes it from the file (it stays in the Git history).

    **Comments in tabs.** A comment on text inside a tab remembers that tab, and its highlight shows when that tab is shown. Each tab label shows a small count of its open comments.

    **When others see it.** You see your own comment at once. Every save is a commit to `main`, so other readers see it after the Pages deploy, usually a few minutes later. While you edit a page, the highlights are hidden; they come back after you save. Frozen versions such as 1.0.0 have no comments.
  </TabItem>

  <TabItem value="api" label="API">
    **Contracts.** `@platform/contracts` defines `CommentsFile` (one per page: `schema`, `page`, `threads`), `CommentThread` (the comment, its `anchor`, `status` open or resolved, who resolved it and when, and `replies`) and `CommentStore` with `read(page)` and `write(page, file, { message, author, expectedEtag })`. A write whose etag no longer matches is `CONFLICT`; a file with no threads left removes the file. Every store passes `describeCommentStoreContract`.

    **Storage.** A page's comments live in `site/comments/<page path without .md>.json`, for example `site/comments/systems/inventory.json`. The folder is outside the OKF bundle, so the generator and validator never see it. Files are two-space JSON with a final newline, so diffs stay readable.

    **Stores.** `GithubCommentStore` (`@platform/content/comments`) reads the file from the tree of `main` and writes it as one Git Data commit that names its expected parent; when `main` moved for another reason it computes the commit again on the new head, like page saves. GitHub refusals become the same plain messages as page saves (token cannot write, expired, rate limited, protected branch). `LocalCommentStore` writes the file on disk; the dev server serves it through `POST <baseUrl>__platform/content/comments` with the same guards as the page endpoint (loopback peer and Host, same Origin, JSON only, the per-process token, a read and write allow-list). `HttpCommentStore` is the browser client for that route.

    **Actions.** `@platform/comments` turns add, reply, resolve, reopen and delete into pure changes of a comments file (`applyOp`). `changeComments` reads the latest file, applies the change and writes it with the etag it read; on `CONFLICT` it applies the change again to the newer file, up to three times, so two editors commenting at once both keep theirs.

    **Readers.** Readers never call the GitHub API. The `platform-comments` site plugin writes `platform/comments/<page>.json` into the build for every Latest page (an empty file when the page has none, so no request fails), and the dev server answers the same addresses from the disk. The page fetches its file after it is shown, with `?v=<buildSha>` so a new deploy is never hidden behind a cached copy. The author's own change is kept in the tab (`docs-platform.pending-comments`, sessionStorage) and shown instead of the published file until a newer build is served or 15 minutes pass.

    **Anchoring.** A comment stores the selected text (`exact`), up to 32 characters before and after it (`prefix`, `suffix`) and the tab it was in (`group`, `value`, `label`), like a W3C TextQuoteSelector. To show it, the page text is read into one string (whitespace runs as one space; tab labels, buttons and heading anchors left out), every place the exact text appears is scored by how much of the stored text around it still matches, places inside the stored tab win, and the best one is used. When the exact text is gone, the comment is unattached.

    **Painting.** Highlights use the CSS Custom Highlight API, so the page's DOM, which React owns, is never changed. Hover and click are found by testing the pointer against the text's client rects. A browser without the API gets boxes drawn in a layer of their own over the text, redrawn when the page's content or size changes. A card opened from the panel takes the keyboard focus and gives it back when it closes. The text is found again whenever the page content changes (a tab switch, the saved preview, a hot reload).

    **Composition.** `site/src/platform/comments/` is the composition root: `createCommentsHost.ts` builds the `CommentsHost` port (published file, session check, tab counts), `mountComments.tsx` is the lazy `comments` chunk, and `commentSession.ts` is a second lazy chunk, loaded on the first comment action, that signs in with the editor's dialog and picks the store (`GithubCommentStore` on the live site, `HttpCommentStore` on `npm start`). The site's Tabs wrapper (`site/src/theme/Tabs`) puts `data-tab-value` on each tab label and `data-comment-count` when it has open comments. `features.comments` in `platform.config.js` switches the whole feature on. The comments sit in an error boundary of their own (`site/src/theme/DocItem/Content`): if their chunk cannot load or they fail, the page is shown without comments.
  </TabItem>

  <TabItem value="misc" label="Misc">
    **Size.** Readers download the comments code as a lazy chunk of about 9 KB (gzip) after the page is shown, plus a small JSON file per page. Signing in and the stores load only on the first comment action.

    **Tests.** Unit tests cover anchoring (`anchor.test.ts`, `textQuote.test.ts`), the actions and the retry (`ops.test.ts`), the pending copy, the publishing plugin and the dev route, and every store passes the contract suite (`commentStores.test.ts`). The Playwright suite (`site/e2e/comments.spec.ts`) adds, hovers, opens, replies, resolves, reopens and deletes comments, checks a comment in a non-first tab with its count, an unattached comment after the text changes, a reader who is not signed in, comment text and names shown as text (never HTML), the keyboard path from the panel into a card, the boxes drawn when the browser has no Highlight API, a page whose comments code cannot load, and dev-mode saving (`site/e2e-dev`). The live run (`npm run e2e:live`) adds and then deletes a comment with a real token.

    **Known limits.** Renaming or deleting a page leaves its comments file behind (it is no longer published). A heavy edit can detach many comments at once; they wait under Unattached. Comments are public, like the rest of the repository. Every comment action is a commit and starts a deploy. There are no notifications. Highlights are tested in Chromium only.
  </TabItem>
</Tabs>
