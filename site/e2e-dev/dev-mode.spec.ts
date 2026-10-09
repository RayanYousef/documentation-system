// Dev-mode saving: on `npm start` the editor signs in with a display name and a save writes the file in the
// working tree. No git commit is made. The test makes its own temporary page ("New page" in the editor) and
// puts site/docs back exactly as it was afterwards, so no real docs stay modified.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCS = path.join(REPO_ROOT, 'site', 'docs');
const TEMP_PAGE = 'e2e-dev-temp.md';

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
let headBefore: string;
let statusBefore: string;

test.beforeAll(() => {
  before = snapshot(DOCS);
  headBefore = git('rev-parse', 'HEAD');
  statusBefore = git('status', '--porcelain', '--', 'site/docs');
});

test.afterAll(() => {
  restore(DOCS, before);
  expect(existsSync(path.join(DOCS, TEMP_PAGE))).toBe(false);
  expect(git('status', '--porcelain', '--', 'site/docs')).toBe(statusBefore);
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
