// Shared e2e fixtures. The served site is the real build; everything the editor does against GitHub goes
// to an in-memory FakeGitHub seeded from this repository's own site/ files, so each test starts from a
// copy of `main` and can inspect the commits it produced. Raw file downloads (3D models referenced by
// repo + path) are served from the working tree. Every test fails on console errors unless it allows them.
import { test as base, expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { GitDataClient } from '@platform/content';
import { FakeGitHub } from '../../services/content/test/FakeGitHub';

export { expect };

// The site package is CommonJS for Playwright's loader, so __dirname is available.
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const OWNER = 'RayanYousef';
export const REPO = 'documentation-system';

/**
 * Tokens the fake accepts. `writer` can do everything, `reader` is not a collaborator, and `noContents` is a
 * fine-grained token of the repository owner that lacks "Contents: Read and write": GitHub shows the owner's
 * role (push: true) but refuses every write with 403. Anything else is rejected (401).
 */
export const TOKENS = { writer: 'good-token', reader: 'reader-token', noContents: 'no-contents-token' } as const;
const USERS: Record<string, { login: string; name: string; email: string; push: boolean; write: boolean }> = {
  [TOKENS.writer]: { login: 'mira', name: 'Mira Okonkwo', email: 'mira@example.com', push: true, write: true },
  [TOKENS.reader]: { login: 'rita', name: 'Rita Reader', email: 'rita@example.com', push: false, write: false },
  [TOKENS.noContents]: { login: 'mira', name: 'Mira Okonkwo', email: 'mira@example.com', push: true, write: false },
};

/** A refusal GitHub gives for a write (real GitHub wording and headers). */
export interface WriteFault { status: number; message: string; headers?: Record<string, string>; when?: (method: string, pathname: string) => boolean }

/**
 * Things that go wrong on the fake GitHub, switched on and off by a test while the page is open: tokens that
 * stop working (expired or revoked), a rate limit, a protected branch, or a network that is down for writes.
 */
export class GitHubFaults {
  /** Tokens GitHub now answers with 401 (Bad credentials). */
  readonly revoked = new Set<string>();
  /** Every write (POST, PATCH, PUT, DELETE) is answered with this, until cleared with `null`. */
  writeFault: WriteFault | null = null;
  /** Writes never reach GitHub (the request fails like a lost connection). */
  writesOffline = false;

  /** Secondary rate limit: 403 with retry-after, as GitHub sends it for bursts of writes. */
  rateLimit(retryAfterSeconds = 120): void {
    this.writeFault = { status: 403, message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.', headers: { 'retry-after': String(retryAfterSeconds) } };
  }
  /** A branch rule on `main`: the final ref update is refused. */
  protectBranch(branch = 'main'): void {
    this.writeFault = { status: 403, message: `Protected branch update failed for refs/heads/${branch}.`, when: (method) => method === 'PATCH' };
  }
  clear(): void { this.revoked.clear(); this.writeFault = null; this.writesOffline = false; }
}

function walk(rel: string, out: Record<string, Uint8Array>, skip: (rel: string) => boolean = () => false): void {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) return;
  if (statSync(abs).isFile()) { out[rel.split(path.sep).join('/')] = new Uint8Array(readFileSync(abs)); return; }
  for (const name of readdirSync(abs)) {
    const child = path.join(rel, name);
    if (!skip(child.split(path.sep).join('/'))) walk(child, out, skip);
  }
}

let seedFiles: Record<string, Uint8Array> | null = null;
/** site/docs, frozen versions, versions.json and static files (not the generated static/platform). */
function seed(): Record<string, Uint8Array> {
  if (seedFiles) return seedFiles;
  const files: Record<string, Uint8Array> = {};
  for (const rel of ['site/docs', 'site/versioned_docs', 'site/versioned_sidebars', 'site/versions.json', 'site/sidebars.js']) walk(rel, files);
  walk('site/static', files, (r) => r.startsWith('site/static/platform'));
  seedFiles = files;
  return files;
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'access-control-expose-headers': '*' };

/** Routes api.github.com (auth checks + FakeGitHub) and raw/media.githubusercontent.com (working tree). */
export async function installGitHub(page: Page, gh: FakeGitHub, faults: GitHubFaults = new GitHubFaults()): Promise<void> {
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    const url = new URL(req.url());
    const token = (req.headers()['authorization'] ?? '').replace(/^(Bearer|token) /, '');
    const user = token ? USERS[token] : undefined;
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (token && (!user || faults.revoked.has(token))) { await json(401, { message: 'Bad credentials' }); return; }
    const isWrite = req.method() !== 'GET' && req.method() !== 'HEAD';
    if (isWrite && faults.writesOffline) { await route.abort('connectionfailed'); return; }
    if (isWrite && user && !user.write) { await json(403, { message: 'Resource not accessible by personal access token' }); return; }
    if (isWrite && faults.writeFault && (faults.writeFault.when?.(req.method(), url.pathname) ?? true)) {
      await route.fulfill({ status: faults.writeFault.status, headers: { ...cors, 'content-type': 'application/json', ...faults.writeFault.headers }, body: JSON.stringify({ message: faults.writeFault.message }) });
      return;
    }
    if (url.pathname === `/repos/${OWNER}/${REPO}` && req.method() === 'GET') { await json(200, { full_name: `${OWNER}/${REPO}`, permissions: { pull: true, push: !!user?.push } }); return; }
    if (url.pathname === '/user') { if (!user) await json(401, { message: 'Requires authentication' }); else await json(200, { login: user.login, name: user.name, email: user.email }); return; }
    const res = await gh.fetch(req.url(), { method: req.method(), body: req.postData() ?? undefined });
    await route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: await res.text() });
  });
  await page.route(/^https:\/\/(raw|media)\.githubusercontent\.com\//, async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/').filter(Boolean);
    const rest = url.hostname.startsWith('media') ? parts.slice(4) : parts.slice(3); // media/<o>/<r>/<ref>/... | <o>/<r>/<ref>/...
    const file = path.join(REPO_ROOT, ...rest.map(decodeURIComponent));
    if (existsSync(file) && statSync(file).isFile()) await route.fulfill({ status: 200, headers: cors, body: readFileSync(file) });
    else await route.fulfill({ status: 404, headers: cors, body: 'Not Found' });
  });
}

export interface ConsoleGuard { allow(pattern: RegExp): void }

export const test = base.extend<{ gh: FakeGitHub; faults: GitHubFaults; consoleGuard: ConsoleGuard }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring pattern for fixture parameters
  faults: async ({}, use) => { await use(new GitHubFaults()); },
  gh: async ({ page, faults }, use) => {
    const gh = new FakeGitHub(OWNER, REPO);
    gh.seed('main', seed());
    await installGitHub(page, gh, faults);
    await use(gh);
  },
  consoleGuard: [async ({ page }, use) => {
    const allowed: RegExp[] = [];
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use({ allow: (p) => allowed.push(p) });
    expect(errors.filter((e) => !allowed.some((p) => p.test(e))), 'console errors').toEqual([]);
  }, { auto: true }],
});

// ---------- helpers ----------

export const editButton = (page: Page) => page.getByTestId('inplace-edit-button');
export const body = (page: Page) => page.locator('[data-platform-editing] [data-slate-editor]');
export const editStatus = (page: Page) => page.getByTestId('edit-status');
export const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
/** The editable region (the edited page) and a button of the formatting toolbar by its accessible name. */
export const editing = (page: Page) => page.locator('[data-platform-editing]');
export const toolbarButton = (page: Page, label: string) => page.getByRole('toolbar', { name: 'Formatting', exact: true }).getByLabel(label, { exact: true });

/** Opens a page and clicks Edit (the sign-in dialog or the editor follows). */
export async function clickEdit(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await editButton(page).click();
}

export async function signInWithToken(page: Page, token: string = TOKENS.writer): Promise<void> {
  await page.getByLabel('GitHub token').fill(token);
  await button(page, 'Sign in').click();
}

/** Opens the editor on a page as the writer and waits for the body. */
export async function openEditor(page: Page, route: string): Promise<void> {
  await clickEdit(page, route);
  await signInWithToken(page);
  await expect(body(page)).toBeVisible();
}

export async function save(page: Page): Promise<void> {
  await button(page, 'Save').click();
}

/**
 * Saves, checks the saved banner, reloads (the tab keeps the saved copy until the next deploy) and opens the
 * editor again, so what the editor shows afterwards was read back from the saved file on the fake `main`.
 */
export async function saveReloadAndEdit(page: Page): Promise<void> {
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
}

/** Text of a repo file on the fake `main` (null when absent). */
export const fileOnMain = (gh: FakeGitHub, repoPath: string): string | null => gh.fileAt('main', repoPath);

/** Commit messages on main, newest first. */
export function commitMessages(gh: FakeGitHub): string[] {
  const out: string[] = [];
  let sha = gh.refs.get('heads/main');
  while (sha) { const c = gh.commits.get(sha)!; out.push(c.message); sha = c.parents[0]; }
  return out;
}

/** Commits a file change on main as someone else (through the fake's own Git Data API). */
export async function commitOnMain(gh: FakeGitHub, repoPath: string, text: string, message = 'Someone else'): Promise<void> {
  await new GitDataClient({ owner: OWNER, repo: REPO, token: null, fetch: gh.fetch }).commitFiles('main', { [repoPath]: text }, [], message, { name: 'Other', email: 'other@example.com' });
}

/** The docs bundle on main as bundle-relative text files (for okf-core checks). */
export function bundleOnMain(gh: FakeGitHub): Record<string, string> {
  const head = gh.commits.get(gh.refs.get('heads/main')!)!;
  const out: Record<string, string> = {};
  for (const [p, sha] of Object.entries(gh.trees.get(head.tree)!)) {
    if (p.startsWith('site/docs/') && /\.(md|json)$/.test(p)) out[p.slice('site/docs/'.length)] = new TextDecoder().decode(gh.blobs.get(sha)!);
  }
  return out;
}

/**
 * Puts the caret at the very end of the first paragraph of the editor that contains `text`. (The End key only
 * goes to the end of the visual line, which is the middle of a paragraph that wraps.)
 */
export async function caretAfter(page: Page, text: string): Promise<void> {
  const p = body(page).locator('p', { hasText: text }).first();
  await p.click();
  await p.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
}
