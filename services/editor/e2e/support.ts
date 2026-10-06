// Shared fixtures and helpers for the editor e2e specs.
// - Every test fails on a console error or an uncaught page error (allow a known one with `allowedConsoleErrors`).
// - The site's own static files (<baseUrl>platform/components.json, models/, uploads/) are served from the
//   temp repo that e2e/content-server.mjs made, the way the deployed site serves them next to <baseUrl>editor/.
// - Pages a test edits are seeded through the content server, one per test, so tests do not depend on each other.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_VERSION } from '@platform/contracts';
import { HttpContentBackend } from '@platform/content';

export { expect };

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

export const CONTENT_URL = 'http://127.0.0.1:4321';
export const BASE_PATH = '/CloudDocumentationPersonal/';
export const RESOURCE = 'https://github.com/RayanYousef/CloudDocumentationPersonal/blob/main/examples/unity-project/Assets/Scripts/Combat';
export const SEED_AUTHOR = { name: 'Seed Bot', email: 'seed@example.com' };

/** The content server's backend, for seeding pages and for changes made behind the editor's back. */
export const backend = new HttpContentBackend(CONTENT_URL);

export const repoPath = async (): Promise<string> => (await readFile(path.join(here, '.repo-path'), 'utf8')).trim();
export const git = async (...args: string[]): Promise<string> => (await run('git', args, { cwd: await repoPath() })).stdout.trim();
/** A file of the temp site, for example `docs/systems/index.md` or `static/uploads/x.png`. */
export const siteFile = async (rel: string): Promise<string> => readFile(path.join(await repoPath(), 'site', ...rel.split('/')), 'utf8');
/** A page of the Latest docs as it is on disk. */
export const docFile = (pagePath: string): Promise<string> => siteFile(`docs/${pagePath}`);
const exists = (p: string) => access(p).then(() => true, () => false);

/** The text after the frontmatter block. */
export const bodyOf = (text: string): string => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

export function pageText(title: string, body: string): string {
  return `---\ntitle: ${title}\ndescription: Seeded by the editor end-to-end tests so a test can change a page of its own.\ntype: system\ntags: [e2e]\nresource: ${RESOURCE}\n---\n\n${body}`;
}

/** Creates `systems/e2e-<slug>-<random>.md` with a valid frontmatter and `body`. Returns the page path. */
export async function seedPage(slug: string, body: string): Promise<string> {
  const pagePath = `systems/e2e-${slug}-${Math.random().toString(36).slice(2, 8)}.md`;
  await backend.createPage(CURRENT_VERSION, pagePath, pageText(`E2E ${slug}`, body), { message: `Seed ${pagePath}`, author: SEED_AUTHOR });
  return pagePath;
}

interface Fixtures {
  /** Console errors a test expects (for example a logged parse error). Everything else fails the test. */
  allowedConsoleErrors: RegExp[];
  consoleErrors: string[];
}

export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [async ({ page, allowedConsoleErrors }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !allowedConsoleErrors.some((r) => r.test(m.text()))) errors.push(`${m.text()} @ ${m.location().url}`);
    });
    page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
  page: async ({ page }, use) => {
    const repo = await repoPath();
    const siteStatic = new RegExp(`^http://127\\.0\\.0\\.1:5173${BASE_PATH}(?!editor/)([^?#]+)`);
    await page.route(siteStatic, async (route) => {
      const rel = decodeURIComponent(siteStatic.exec(route.request().url())?.[1] ?? '');
      const file = path.join(repo, 'site', 'static', ...rel.split('/'));
      if (rel.split('/').includes('..') || !(await exists(file))) await route.fulfill({ status: 404, body: 'Not found' });
      else await route.fulfill({ path: file });
    });
    await use(page);
  },
});

// ---------- UI helpers ----------

export async function signIn(page: Page, name = 'Mock Editor'): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Signed in as')).toBeVisible();
}

/** Opens a page through the file picker (filtered, so long lists do not matter). */
export async function openPage(page: Page, pagePath: string): Promise<void> {
  await page.getByLabel('Filter pages').fill(pagePath);
  await page.getByRole('button', { name: pagePath, exact: true }).click();
  await expect(page.getByRole('heading', { name: pagePath })).toBeVisible();
}

export const richBody = (page: Page): Locator => page.getByRole('textbox', { name: 'Page body' });
export const toolbar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Formatting', exact: true });
/** A toolbar control by its accessible name (toggle buttons are radios, menus are buttons). */
export const tool = (page: Page, label: string): Locator => toolbar(page).getByLabel(label, { exact: true });
export const unsaved = (page: Page): Locator => page.getByText('Unsaved changes');
/** The app's status line (role status; a 3D viewer has a status element of its own). */
export const appStatus = (page: Page): Locator => page.getByTestId('app-status');

/** Puts the cursor at the end of the body (clicking the last block) and starts a new empty paragraph. */
export async function newParagraphAtEnd(page: Page): Promise<void> {
  await richBody(page).locator('[data-slate-node="element"]').last().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
}

export const floatingToolbar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Selection formatting' });

/**
 * Selects `count` characters to the left of the (collapsed) cursor. Slate takes a keyboard selection over
 * from the browser a moment later; the floating toolbar shows once it has, so wait for that before a command.
 */
export async function selectLeft(page: Page, count: number): Promise<void> {
  await expect(floatingToolbar(page)).toHaveCount(0);
  for (let i = 0; i < count; i++) await page.keyboard.press('Shift+ArrowLeft');
  await expect(floatingToolbar(page)).toBeVisible();
}

/** Where pointTo left the mouse, per page. */
const lastPointer = new WeakMap<Page, { x: number; y: number }>();

/** The box of `target` once it stops moving (menus animate in). Does not touch the mouse. */
const boxOf = async (target: Locator) => {
  await expect(target).toBeVisible();
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await target.boundingBox());
    const settled = now === last && now !== 'null';
    last = now;
    return settled;
  }, { intervals: [50] }).toBe(true);
  const box = await target.boundingBox();
  if (!box) throw new Error('target has no box');
  return box;
};

/**
 * Moves the mouse onto `target` in small steps, as a hand does (a submenu closes when the pointer jumps).
 * With `within` (the submenu), the pointer first goes straight sideways into it, then to the target.
 */
export async function pointTo(page: Page, target: Locator, within?: Locator): Promise<void> {
  const box = await boxOf(target);
  if (within) {
    const area = await boxOf(within);
    const from = lastPointer.get(page) ?? { x: 0, y: 0 };
    const x = Math.min(Math.max(from.x, area.x + 4), area.x + area.width - 4);
    const y = Math.min(Math.max(from.y, area.y + 4), area.y + area.height - 4);
    await page.mouse.move(x, y, { steps: 8 });
  }
  const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(end.x, end.y, { steps: 12 });
  lastPointer.set(page, end);
}

/** The open submenu of a dropdown menu. */
export const subMenu = (page: Page): Locator => page.locator('[data-slot="dropdown-menu-sub-content"][data-state="open"]');

/** Hovers a submenu trigger of the open menu and waits for the submenu. */
export async function openSubmenu(page: Page, name: string): Promise<void> {
  const trigger = page.getByRole('menuitem', { name, exact: true });
  await trigger.hover();
  const box = await trigger.boundingBox();
  if (box) lastPointer.set(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await expect(subMenu(page)).toBeVisible();
}

/** Opens a submenu of a toolbar menu and picks an item in it. */
export async function pickSubmenuItem(page: Page, menuLabel: string, submenu: string, item: string): Promise<void> {
  await tool(page, menuLabel).click();
  await openSubmenu(page, submenu);
  const target = page.getByRole('menuitem', { name: item, exact: true });
  await pointTo(page, target, subMenu(page));
  await target.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

/** Saves with `message` and waits until the commit is done and the page is clean again. */
export async function save(page: Page, message: string): Promise<void> {
  await page.getByLabel('Commit message').fill(message);
  await page.getByRole('button', { name: 'Save & commit' }).click();
  await expect(appStatus(page)).toContainText('Committed');
  await expect(unsaved(page)).toHaveCount(0);
}

/** Saves, then returns the page body as the content server wrote it. */
export async function saveAndRead(page: Page, pagePath: string, message = `Update ${pagePath}`): Promise<string> {
  await save(page, message);
  expect(await git('log', '-1', '--format=%s')).toBe(message);
  return bodyOf(await docFile(pagePath));
}
