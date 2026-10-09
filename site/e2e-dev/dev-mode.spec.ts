// Dev-mode saving: on `npm start` the editor signs in with a display name and a save writes the file in the
// working tree. No git commit is made. The tests make their own temporary pages ("New page" in the editor) and
// comments, and put site/docs and site/comments back exactly as they were afterwards, so nothing real stays modified.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { highlighted, selectText } from '../e2e/support';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(REPO_ROOT, 'site', 'docs');
const COMMENTS = path.join(REPO_ROOT, 'site', 'comments');
const TEMP_PAGE = 'e2e-dev-temp.md';
const FEATURE_PAGE = 'e2e-dev-feature.md';

const git = (...args: string[]) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();

function snapshot(dir: string, out: Map<string, Buffer> = new Map()): Map<string, Buffer> {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) snapshot(abs, out);
    else out.set(abs, readFileSync(abs));
  }
  return out;
}

/** Puts every file under `dir` back as it was in `before`; files that did not exist are deleted. */
function restore(dir: string, before: Map<string, Buffer>): void {
  const now = snapshot(dir);
  for (const abs of now.keys()) if (!before.has(abs)) rmSync(abs, { force: true });
  for (const [abs, bytes] of before) if (!now.has(abs) || !now.get(abs)!.equals(bytes)) writeFileSync(abs, bytes);
}

let before: Map<string, Buffer>;
let commentsBefore: Map<string, Buffer> | null;
let headBefore: string;
let statusBefore: string;

test.beforeAll(() => {
  before = snapshot(DOCS);
  commentsBefore = existsSync(COMMENTS) ? snapshot(COMMENTS) : null;
  headBefore = git('rev-parse', 'HEAD');
  statusBefore = git('status', '--porcelain', '--', 'site/docs', 'site/comments');
});

test.afterAll(() => {
  restore(DOCS, before);
  if (commentsBefore) restore(COMMENTS, commentsBefore);
  else rmSync(COMMENTS, { recursive: true, force: true });
  expect(existsSync(path.join(DOCS, TEMP_PAGE))).toBe(false);
  expect(existsSync(path.join(DOCS, FEATURE_PAGE))).toBe(false);
  expect(git('status', '--porcelain', '--', 'site/docs', 'site/comments')).toBe(statusBefore);
});

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('on the dev server a new page and an edit are written to disk, with no commit; site/docs is restored after', async ({ page }) => {
  await page.goto('getting-started');
  await page.getByTestId('inplace-edit-button').click();
  // Development sign-in: a display name, no token.
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  await expect(dialog).toContainText('saves are written to the files in your working tree');
  await dialog.getByLabel('Display name').fill('Dev Tester');
  await button(page, 'Sign in').click();
  await expect(page.locator('[data-platform-editing] [data-slate-editor]')).toBeVisible();

  // A temporary page, made with the editor itself.
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: 'New page in this folder...' }).click();
  const newPage = page.getByRole('dialog', { name: 'New page' });
  await newPage.getByLabel('New page path').fill(TEMP_PAGE);
  await newPage.getByLabel('New page title').fill('E2E Dev Temp');
  await newPage.getByLabel('New page description').fill('A temporary page made by the dev-mode end-to-end test; it is deleted afterwards.');
  await newPage.getByLabel('New page type').fill('guide');
  await button(page, 'Create').click();

  const file = path.join(DOCS, TEMP_PAGE);
  await expect.poll(() => existsSync(file)).toBe(true);
  expect(readFileSync(file, 'utf8')).toContain('title: E2E Dev Temp');
  expect(git('rev-parse', 'HEAD')).toBe(headBefore); // created on disk only

  // The dev server picks the page up; edit it.
  await expect.poll(async () => (await page.request.get('e2e-dev-temp')).status(), { timeout: 120_000 }).toBe(200);
  await page.goto('e2e-dev-temp');
  await page.getByTestId('inplace-edit-button').click();
  const editor = page.locator('[data-platform-editing] [data-slate-editor]');
  await expect(editor).toBeVisible();
  await editor.locator('p').first().click();
  await page.keyboard.type('Written by the dev-mode test.');
  await button(page, 'Save').click();

  await expect(page.getByTestId('saved-banner')).toContainText('Saved to disk');
  await expect.poll(() => readFileSync(file, 'utf8')).toContain('Written by the dev-mode test.');
  expect(readFileSync(path.join(DOCS, 'log.md'), 'utf8')).toContain('E2E Dev Temp');
  expect(git('rev-parse', 'HEAD')).toBe(headBefore); // saved on disk only: no commit
  expect(git('status', '--porcelain', '--', 'site/docs')).toContain(TEMP_PAGE);

  // A second save keeps working (reads the file back, writes it again). The dev server hot-reloads the page
  // after the first save, so start from a fresh load.
  await page.goto('e2e-dev-temp');
  await page.getByTestId('inplace-edit-button').click();
  await expect(editor).toBeVisible();
  await editor.locator('p', { hasText: 'Written by the dev-mode test.' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' And a second save.');
  await button(page, 'Save').click();
  await expect.poll(() => readFileSync(file, 'utf8')).toContain('Written by the dev-mode test. And a second save.');
  expect(git('rev-parse', 'HEAD')).toBe(headBefore);
});

test('on the dev server a comment is written to site/comments with no commit, read back from the disk, and deleted again', async ({ page }) => {
  const file = path.join(COMMENTS, 'getting-started.json');
  const commentsFile = () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { threads: { body: string; status: string; author: { login: string } }[] } : null);
  await page.goto('getting-started');
  await expect(page.getByTestId('comments-button')).toBeVisible();
  await selectText(page.locator('article .theme-doc-markdown'), 'Universal Render Pipeline');
  await button(page, 'Sign in to comment').click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  await expect(dialog).toContainText('saves are written to the files in your working tree');
  await dialog.getByLabel('Display name').fill('Dev Tester');
  await button(page, 'Sign in').click();
  const box = page.getByRole('dialog', { name: 'New comment' });
  await box.getByLabel('Comment').fill('Which URP version?');
  await box.getByRole('button', { name: 'Save' }).click();
  await expect(box).toHaveCount(0);

  await expect.poll(() => commentsFile()?.threads.map((t) => t.body)).toEqual(['Which URP version?']);
  expect(commentsFile()!.threads[0]!.author.login).toBe('dev-tester');
  expect(git('rev-parse', 'HEAD')).toBe(headBefore); // on disk only: no commit
  await expect.poll(() => highlighted(page)).toEqual(['Universal Render Pipeline']);

  // A reload reads the file from the disk (the dev server serves it fresh).
  await page.reload();
  await expect(page.getByTestId('comments-button')).toHaveAccessibleName('Comments (1 open)');
  await expect.poll(() => highlighted(page)).toEqual(['Universal Render Pipeline']);

  // Resolve, then delete for good: the file goes away.
  await page.getByTestId('comments-button').click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  await panel.getByTestId('comment-item').getByRole('button').click();
  await page.getByRole('dialog', { name: 'Comment thread' }).getByRole('button', { name: 'Resolve' }).click();
  await expect.poll(() => commentsFile()?.threads[0]?.status).toBe('resolved');
  await panel.getByRole('tab', { name: /^Resolved/ }).click();
  await panel.getByRole('button', { name: 'Delete' }).click();
  await panel.getByRole('alertdialog', { name: 'Delete this comment for good?' }).getByRole('button', { name: 'Delete for good' }).click();
  await expect.poll(() => existsSync(file)).toBe(false);
  expect(git('rev-parse', 'HEAD')).toBe(headBefore);
});

test('a Feature page made on the dev server shows its three tabs as heading-size tab labels, and opens in the visual editor', async ({ page }) => {
  await page.goto('getting-started');
  await page.getByTestId('inplace-edit-button').click();
  const editor = page.locator('[data-platform-editing] [data-slate-editor]');
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  if (await Promise.race([dialog.waitFor().then(() => true), editor.waitFor().then(() => false)])) {
    await dialog.getByLabel('Display name').fill('Dev Tester');
    await button(page, 'Sign in').click();
  }
  await expect(editor).toBeVisible();
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: 'New page in this folder...' }).click();
  const newPage = page.getByRole('dialog', { name: 'New page' });
  await newPage.getByRole('radio', { name: 'Feature page' }).check();
  await newPage.getByLabel('New page path').fill(FEATURE_PAGE);
  await newPage.getByLabel('New page title').fill('E2E Dev Feature');
  await newPage.getByLabel('New page description').fill('A temporary feature page made by the dev-mode end-to-end test; it is deleted afterwards.');
  await newPage.getByLabel('New page type').fill('guide');
  await button(page, 'Create').click();
  await expect.poll(() => existsSync(path.join(DOCS, FEATURE_PAGE))).toBe(true);

  await expect.poll(async () => (await page.request.get('e2e-dev-feature')).status(), { timeout: 120_000 }).toBe(200);
  await page.goto('e2e-dev-feature');
  const tabs = page.locator('article .theme-doc-markdown .tabs-container [role="tab"]');
  await expect(tabs).toHaveText(['How to use', 'API', 'Misc']);
  await expect(tabs.first()).toHaveCSS('font-size', '24px'); // the size of the page's H3
  await expect(page.locator('article [role="tabpanel"]:not([hidden])')).toContainText('Explain how to use this feature');

  await page.getByTestId('inplace-edit-button').click();
  const editorTabs = page.locator('[data-platform-editing] .tabs-container ul.tabs > li.tabs__item');
  await expect(editorTabs).toHaveText(['How to use', 'API', 'Misc']);
  await expect(page.getByText('This file could not be opened in the visual editor')).toHaveCount(0);
});
