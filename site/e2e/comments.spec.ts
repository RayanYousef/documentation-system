// Comments on the text of a page (site/docs/platform/comments.md, a feature page with tabs). Readers get the
// published comments file of the build (served by seedComments when a test needs some); editors' changes are
// commits on the fake `main`, read back from there.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  test, expect, button, commitMessages, commentsButton, editButton, fileOnMain, highlightBoxes, highlighted, pageContent,
  seedComments, selectText, signInThroughEdit, signInWithToken, textPoint, body, save, caretAfter, REPO_ROOT, type ThreadFixture,
} from './support';

const ROUTE = 'platform/comments';
const PAGE = 'platform/comments.md';
const FILE = 'site/comments/platform/comments.json';
const HOW_TO_USE = { group: 0, value: 'how-to-use', label: 'How to use' };
const API = { group: 0, value: 'api', label: 'API' };

const stored = (gh: Parameters<typeof fileOnMain>[0]) => {
  const text = fileOnMain(gh, FILE);
  return text ? (JSON.parse(text) as { threads: { id: string; body: string; status: string; anchor: { exact: string; tab: unknown }; author: { login: string }; replies: { body: string }[] }[] }) : null;
};
const panel = (page: Page) => page.getByRole('complementary', { name: 'Comments' });
const card = (page: Page) => page.getByRole('dialog', { name: 'Comment thread' });
const newComment = (page: Page) => page.getByRole('dialog', { name: 'New comment' });
const tabLabel = (page: Page, name: string) => pageContent(page).locator('[role="tab"]', { hasText: name });

async function open(page: Page): Promise<void> {
  await page.goto(ROUTE);
  await expect(commentsButton(page)).toBeVisible();
}

/** Selects text and saves a comment on it (signed in already). */
async function comment(page: Page, text: string, body: string): Promise<void> {
  await selectText(pageContent(page), text);
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await newComment(page).getByLabel('Comment').fill(body);
  await newComment(page).getByRole('button', { name: 'Save' }).click();
  await expect(newComment(page)).toHaveCount(0);
}

async function openCard(page: Page, text: string): Promise<void> {
  const p = await textPoint(pageContent(page), text);
  await page.mouse.click(p.x, p.y);
  await expect(card(page)).toBeVisible();
}

test('add: select text, sign in from the Comment button, Save; one commit; highlighted, hover shows it, click opens it, kept after a reload', async ({ page, gh }) => {
  await open(page);
  await expect(commentsButton(page)).toHaveAccessibleName('Comments');
  await selectText(pageContent(page), 'yellow highlight');
  await page.getByRole('button', { name: 'Sign in to comment' }).click();
  await expect(page.getByRole('dialog', { name: 'Sign in to edit' })).toBeVisible();
  await signInWithToken(page);
  await newComment(page).getByLabel('Comment').fill('Which yellow exactly?');
  await newComment(page).getByRole('button', { name: 'Save' }).click();
  await expect(newComment(page)).toHaveCount(0);

  // One commit with one file: the comment, its author, the quote and the tab it is in.
  expect(commitMessages(gh)[0]).toBe('Comment on platform/comments.md');
  const file = stored(gh)!;
  expect(file.threads).toHaveLength(1);
  expect(file.threads[0]).toMatchObject({ body: 'Which yellow exactly?', status: 'open', author: { login: 'mira' }, anchor: { exact: 'yellow highlight', tab: HOW_TO_USE } });
  expect(fileOnMain(gh, 'site/docs/platform/comments.md')).toBe(readFileSync(path.join(REPO_ROOT, 'site/docs/platform/comments.md'), 'utf8')); // the page itself is untouched
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await expect(commentsButton(page)).toHaveAccessibleName('Comments (1 open)');

  // Hover shows the comment; a click opens the thread.
  const p = await textPoint(pageContent(page), 'yellow highlight');
  await page.mouse.move(p.x, p.y);
  await expect(page.getByRole('tooltip')).toContainText('Which yellow exactly?');
  await expect(page.getByRole('tooltip')).toContainText('mira');
  await page.mouse.move(5, 5);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await openCard(page, 'yellow highlight');
  await expect(card(page)).toContainText('mira');
  await expect(card(page)).toContainText('Which yellow exactly?');
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);

  // The deploy has not published it yet: this tab keeps showing it after a reload.
  await page.reload();
  await expect(commentsButton(page)).toBeVisible();
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
});

test('reply and resolve (the highlight goes, it is listed under Resolved), reopen, and delete for good', async ({ page, gh }) => {
  await seedComments(page, gh, PAGE, [{ id: 'c1', body: 'Is yellow readable in dark mode?', exact: 'yellow highlight', prefix: 'Commented text has a ', suffix: '. Point at it', tab: HOW_TO_USE }]);
  await open(page);
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await signInThroughEdit(page);

  // Reply.
  await openCard(page, 'yellow highlight');
  await card(page).getByLabel('Reply').fill('Yes, it is lighter there.');
  await card(page).getByRole('button', { name: 'Reply', exact: true }).click();
  await expect.poll(() => stored(gh)!.threads[0]!.replies.map((r) => r.body)).toEqual(['Yes, it is lighter there.']);
  await expect(card(page).locator('.pc-entry').nth(1)).toContainText('Yes, it is lighter there.');
  await expect(card(page).getByLabel('Reply')).toHaveValue('');
  expect(commitMessages(gh)[0]).toBe('Reply to a comment on platform/comments.md');

  // Resolve: no highlight, no hover card; listed under Resolved only.
  await card(page).getByRole('button', { name: 'Resolve' }).click();
  await expect(card(page)).toHaveCount(0);
  await expect.poll(() => highlighted(page)).toEqual([]);
  await expect.poll(() => stored(gh)!.threads[0]!.status).toBe('resolved');
  await commentsButton(page).click();
  await expect(panel(page).getByText('No open comments.')).toBeVisible();
  await panel(page).getByRole('tab', { name: /^Resolved/ }).click();
  const resolved = panel(page).getByTestId('resolved-item');
  await expect(resolved).toHaveCount(1);
  await expect(resolved).toContainText('Is yellow readable in dark mode?');
  await expect(resolved).toContainText('Resolved by mira');

  // Reopen: back on the page.
  await resolved.getByRole('button', { name: 'Reopen' }).click();
  await expect(resolved).toHaveCount(0);
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await expect.poll(() => stored(gh)!.threads[0]!.status).toBe('open');

  // Resolve again from the card, then delete it for good from the Resolved tab.
  await panel(page).getByRole('button', { name: 'Close comments' }).click();
  await openCard(page, 'yellow highlight');
  await card(page).getByRole('button', { name: 'Resolve' }).click();
  await expect.poll(() => highlighted(page)).toEqual([]);
  await commentsButton(page).click();
  await panel(page).getByRole('tab', { name: /^Resolved/ }).click();
  await panel(page).getByTestId('resolved-item').getByRole('button', { name: 'Delete' }).click();
  const confirm = panel(page).getByRole('alertdialog', { name: 'Delete this comment for good?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete for good' }).click();
  await expect(panel(page).getByTestId('resolved-item')).toHaveCount(0);
  await expect.poll(() => fileOnMain(gh, FILE)).toBeNull(); // the last thread: the file is removed
  expect(commitMessages(gh).slice(0, 5)).toEqual([
    'Delete a comment on platform/comments.md', 'Resolve a comment on platform/comments.md', 'Reopen a comment on platform/comments.md',
    'Resolve a comment on platform/comments.md', 'Reply to a comment on platform/comments.md',
  ]);
});

test('a comment in a non-first tab remembers the tab, shows with it, and the tab label counts it', async ({ page, gh }) => {
  await open(page);
  await signInThroughEdit(page);
  await tabLabel(page, 'API').click();
  await comment(page, 'never call the GitHub API', 'Not even for private assets?');
  expect(stored(gh)!.threads[0]!.anchor).toMatchObject({ exact: 'never call the GitHub API', tab: API });

  // The API tab counts one open comment; the others none.
  await expect(tabLabel(page, 'API')).toHaveAttribute('data-comment-count', '1');
  await expect(tabLabel(page, 'How to use')).not.toHaveAttribute('data-comment-count', /.*/);
  await expect.poll(() => highlightBoxes(page)).toBeGreaterThan(0);

  // Its highlight shows only while its tab is shown.
  await tabLabel(page, 'How to use').click();
  await expect.poll(() => highlightBoxes(page)).toBe(0);
  await expect.poll(() => highlighted(page)).toEqual(['never call the GitHub API']);

  // From the panel: the comment says which tab it is in, and opening it shows that tab.
  await commentsButton(page).click();
  const item = panel(page).getByTestId('comment-item');
  await expect(item).toContainText('In tab: API');
  await item.getByRole('button').click();
  await expect(tabLabel(page, 'API')).toHaveAttribute('aria-selected', 'true');
  await expect(card(page)).toContainText('Not even for private assets?');
  await expect.poll(() => highlightBoxes(page)).toBeGreaterThan(0);
});

test('a comment whose text was edited away moves to Unattached in the Open tab, never lost', async ({ page, gh }) => {
  await open(page);
  await signInThroughEdit(page);
  await comment(page, 'yellow highlight', 'Name the colour.');
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);

  // Edit the page: the commented words change. Highlights are hidden while editing.
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
  await expect(commentsButton(page)).toHaveCount(0);
  await expect.poll(() => highlighted(page)).toEqual([]);
  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await expect(cm).toContainText('a yellow highlight');
  const before = fileOnMain(gh, 'site/docs/platform/comments.md')!;
  await cm.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(before.replace('a yellow highlight', 'a coloured background'));
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();

  // After the save the comments are back; this one lost its text.
  await expect(commentsButton(page)).toHaveAccessibleName('Comments (1 open)');
  await expect.poll(() => highlighted(page)).toEqual([]);
  await commentsButton(page).click();
  const unattached = panel(page).getByRole('region', { name: 'Unattached' });
  await expect(unattached).toContainText('yellow highlight');
  await expect(unattached).toContainText('Name the colour.');
  await expect(panel(page).getByTestId('comment-item')).toHaveCount(0);
  // Still answerable there.
  await unattached.getByRole('button', { name: 'Resolve' }).click();
  await expect(unattached).toHaveCount(0);
  await expect.poll(() => stored(gh)!.threads[0]!.status).toBe('resolved');
});

test('highlights are hidden while editing and come back after the save (on the saved version)', async ({ page, gh }) => {
  await seedComments(page, gh, PAGE, [{ id: 'c1', body: 'Is yellow readable in dark mode?', exact: 'yellow highlight', tab: HOW_TO_USE }]);
  await open(page);
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await editButton(page).click();
  await signInWithToken(page);
  await expect(body(page)).toBeVisible();
  await expect(commentsButton(page)).toHaveCount(0);
  await expect.poll(() => highlighted(page)).toEqual([]);
  await caretAfter(page, 'Anyone reading a Latest docs page');
  await page.keyboard.type(' Try it on this page.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await expect(commentsButton(page)).toHaveAccessibleName('Comments (1 open)');
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await expect.poll(() => highlightBoxes(page)).toBeGreaterThan(0);
  await openCard(page, 'yellow highlight');
  await expect(card(page)).toContainText('Is yellow readable in dark mode?');
});

test('right after a save, a comment can be made on the saved version and is still there after a reload', async ({ page, gh }) => {
  await open(page);
  await editButton(page).click();
  await signInWithToken(page);
  await expect(body(page)).toBeVisible();
  await caretAfter(page, 'Anyone reading a Latest docs page');
  await page.keyboard.type(' Freshly saved words.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await comment(page, 'Freshly saved words.', 'On the saved version.');
  await expect.poll(() => stored(gh)?.threads.map((t) => t.anchor.exact)).toEqual(['Freshly saved words.']);
  await expect.poll(() => highlighted(page)).toEqual(['Freshly saved words.']);
  await page.reload();
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await expect(commentsButton(page)).toHaveAccessibleName('Comments (1 open)');
  await expect.poll(() => highlighted(page)).toEqual(['Freshly saved words.']);
});

test('a reader who is not signed in sees comments and threads but cannot add, reply or resolve', async ({ page, gh }) => {
  const threads: ThreadFixture[] = [
    { id: 'c1', body: 'Is yellow readable in dark mode?', exact: 'yellow highlight', tab: HOW_TO_USE, replies: [{ id: 'r1', body: 'Yes.', login: 'mira' }] },
    { id: 'c2', body: 'Old note.', exact: 'Frozen versions such as 1.0.0 have no comments', tab: HOW_TO_USE, status: 'resolved' },
    { id: 'c3', body: 'This text is gone.', exact: 'A sentence that is no longer on the page', tab: null },
  ];
  await seedComments(page, gh, PAGE, threads);
  const commitsBefore = commitMessages(gh).length;
  await open(page);
  await expect(commentsButton(page)).toHaveAccessibleName('Comments (2 open)');
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']); // not the resolved one, not the unattached one

  const p = await textPoint(pageContent(page), 'yellow highlight');
  await page.mouse.move(p.x, p.y);
  await expect(page.getByRole('tooltip')).toContainText('1 reply');
  await openCard(page, 'yellow highlight');
  await expect(card(page)).toContainText('rita');
  await expect(card(page)).toContainText('Yes.');
  await expect(card(page).getByRole('button', { name: 'Reply' })).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: 'Resolve' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await commentsButton(page).click();
  await expect(panel(page).getByTestId('comment-item')).toHaveCount(1);
  await expect(panel(page).getByRole('region', { name: 'Unattached' })).toContainText('This text is gone.');
  await panel(page).getByRole('tab', { name: /^Resolved/ }).click();
  await expect(panel(page).getByTestId('resolved-item')).toContainText('Old note.');
  await expect(panel(page).getByRole('button', { name: 'Reopen' })).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Close comments' }).click();

  // Selecting text offers sign-in, not a comment box.
  await selectText(pageContent(page), 'Select some text on the page');
  await expect(page.getByRole('button', { name: 'Comment', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in to comment' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  await expect(dialog).toBeVisible();
  await button(page, 'Cancel').click();
  await expect(dialog).toHaveCount(0);
  await expect(newComment(page)).toHaveCount(0);
  expect(commitMessages(gh).length).toBe(commitsBefore);
});

test('moving to another page in the site shows that page\'s comments only', async ({ page, gh }) => {
  await seedComments(page, gh, PAGE, [{ id: 'c1', body: 'Here.', exact: 'yellow highlight', tab: HOW_TO_USE }]);
  await open(page);
  await expect.poll(() => highlighted(page)).toEqual(['yellow highlight']);
  await page.locator('nav.menu').getByRole('link', { name: 'Editor service', exact: true }).click(); // client-side navigation
  await expect(page).toHaveURL(/platform\/editor$/);
  await expect(commentsButton(page)).toHaveAccessibleName('Comments');
  await expect.poll(() => highlighted(page)).toEqual([]);
});

test('comments are not offered on frozen versions', async ({ page, gh: _gh }) => {
  await page.goto('1.0.0/systems/');
  await expect(page.locator('article h1').first()).toBeVisible();
  await expect(commentsButton(page)).toHaveCount(0);
});

test('comment text and author names are shown as text, never as HTML', async ({ page, gh }) => {
  await seedComments(page, gh, PAGE, [{
    id: 'c1', body: '<img src="x" onerror="window.__pwned = 1">Bold <b>claim</b>', exact: 'yellow highlight', tab: HOW_TO_USE, login: '<script>window.__pwned = 2</script>',
    replies: [{ id: 'r1', body: '<a href="javascript:window.__pwned = 3">click</a>', login: '<i>x</i>' }],
  }]);
  await open(page);
  await openCard(page, 'yellow highlight');
  await expect(card(page)).toContainText('<img src="x" onerror="window.__pwned = 1">Bold <b>claim</b>');
  await expect(card(page)).toContainText('<script>window.__pwned = 2</script>');
  await expect(card(page)).toContainText('<a href="javascript:window.__pwned = 3">click</a>');
  await expect(card(page).locator('img, script, b, a, i')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
});

test('when the comments code cannot load, the page is still shown (only without comments)', async ({ page, gh: _gh, consoleGuard }) => {
  consoleGuard.allow(/Failed to load resource: net::ERR_FAILED|ChunkLoadError: Loading chunk \d+ failed[\s\S]*\/comments\.[0-9a-f]+\.js/);
  await page.route(/\/assets\/js\/comments\.[0-9a-f]+\.js$/, (route) => route.abort());
  await page.goto(ROUTE);
  await expect(editButton(page)).toBeVisible();
  await expect(pageContent(page)).toContainText('Anyone reading a Latest docs page');
  await page.waitForLoadState('networkidle');
  await expect(commentsButton(page)).toHaveCount(0);
  await expect(page.getByText('This page crashed')).toHaveCount(0);
  await expect(pageContent(page)).toContainText('Anyone reading a Latest docs page');
});
