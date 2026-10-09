// Shared e2e fixtures. The served site is the real build; everything the editor does against GitHub goes
// to an in-memory FakeGitHub seeded from this repository's own site/ files, so each test starts from a
// copy of `main` and can inspect the commits it produced. Raw file downloads (3D models referenced by
// repo + path) are served from the working tree. Every test fails on console errors unless it allows them.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
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
/** site/docs, frozen versions, versions.json, comments and static files (not the generated static/platform). */
function seed(): Record<string, Uint8Array> {
  if (seedFiles) return seedFiles;
  const files: Record<string, Uint8Array> = {};
  for (const rel of ['site/docs', 'site/versioned_docs', 'site/versioned_sidebars', 'site/versions.json', 'site/sidebars.js', 'site/comments']) walk(rel, files);
  walk('site/static', files, (r) => r.startsWith('site/static/platform'));
  seedFiles = files;
  return files;
}

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'access-control-expose-headers': '*' };

/** Bytes of a repo file on a fake branch (null when absent). */
export function fileBytesAt(gh: FakeGitHub, branch: string, repoPath: string): Uint8Array | null {
  const commit = gh.commits.get(gh.refs.get(`heads/${branch}`)!);
  const sha = commit ? gh.trees.get(commit.tree)?.[repoPath] : undefined;
  return sha ? gh.blobs.get(sha) ?? null : null;
}

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
    if (existsSync(file) && statSync(file).isFile()) { await route.fulfill({ status: 200, headers: cors, body: readFileSync(file) }); return; }
    // Not in the working tree: a file that was committed during the test (an upload), as raw.githubusercontent.com would serve it.
    const from = url.hostname.startsWith('media') ? 1 : 0;
    const committed = parts[from] === OWNER && parts[from + 1] === REPO ? fileBytesAt(gh, 'main', rest.slice(0).map(decodeURIComponent).join('/')) : null;
    if (committed) await route.fulfill({ status: 200, headers: cors, body: Buffer.from(committed) });
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
  await caretAtEnd(page, body(page).locator('p', { hasText: text }).first());
}

/**
 * Puts the caret at the very end of `el` (a paragraph or a code line of the editor) with one real click on the right
 * half of its last character, then waits until the editor has read that caret. The editor reads DOM selection
 * changes at most every 100 ms, so an Enter pressed right after a click and End (or a scripted selection) could
 * still split the line where the click landed.
 */
export async function caretAtEnd(page: Page, el: Locator): Promise<void> {
  await el.scrollIntoViewIfNeeded();
  const point = await el.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if ((n.textContent ?? '').replace(/\uFEFF/g, '').length) last = n as Text;
    if (!last) return null;
    const range = document.createRange();
    range.setStart(last, last.length - 1);
    range.setEnd(last, last.length);
    const rects = range.getClientRects();
    const r = rects[rects.length - 1] ?? range.getBoundingClientRect();
    return { x: r.right - Math.min(1, r.width / 4), y: r.top + r.height / 2 };
  });
  if (point) await page.mouse.click(point.x, point.y);
  else await el.click();
  await expect.poll(() => el.evaluate((node) => {
    const s = window.getSelection();
    if (!s || !s.isCollapsed || !s.focusNode || !node.contains(s.focusNode)) return false;
    const after = document.createRange();
    after.setStart(s.focusNode, s.focusOffset);
    after.setEnd(node, node.childNodes.length);
    return after.toString().replace(/\uFEFF/g, '') === '';
  })).toBe(true);
  await page.waitForTimeout(150); // one throttle window of the editor's selection reading
}

// ---------- comments ----------

export const commentsButton = (page: Page) => page.getByTestId('comments-button');
/** The page's content as readers see it (the built page, or the saved preview after a save). */
export const pageContent = (page: Page) => page.locator('article .theme-doc-markdown');

export interface ThreadFixture {
  id: string; body: string; exact: string; prefix?: string; suffix?: string;
  tab?: { group: number; value: string; label: string } | null;
  status?: 'open' | 'resolved'; login?: string; replies?: { id: string; body: string; login?: string }[];
}

/** A comments file as the store writes it. */
export function commentsFile(pagePath: string, threads: ThreadFixture[]): string {
  const author = (login = 'rita') => ({ login, name: login === 'mira' ? 'Mira Okonkwo' : 'Rita Reader' });
  return `${JSON.stringify({
    schema: 1,
    page: pagePath,
    threads: threads.map((t) => ({
      id: t.id, author: author(t.login), createdAt: '2026-10-08T09:30:00.000Z', body: t.body,
      anchor: { exact: t.exact, prefix: t.prefix ?? '', suffix: t.suffix ?? '', tab: t.tab ?? null },
      status: t.status ?? 'open',
      ...(t.status === 'resolved' ? { resolvedAt: '2026-10-08T10:00:00.000Z', resolvedBy: author('rita') } : {}),
      replies: (t.replies ?? []).map((r) => ({ id: r.id, author: author(r.login), createdAt: '2026-10-08T09:45:00.000Z', body: r.body })),
    })),
  }, null, 2)}\n`;
}

/**
 * The page's comments as a deploy would have published them (served in place of the built file), and the same
 * file on the fake `main`, where signed-in editors read it before changing it.
 */
export async function seedComments(page: Page, gh: FakeGitHub, pagePath: string, threads: ThreadFixture[]): Promise<void> {
  const text = commentsFile(pagePath, threads);
  const name = pagePath.replace(/\.mdx?$/, '.json');
  await page.route(new RegExp(`/platform/comments/${name.replace(/[.]/g, '\\.')}(\\?|$)`), (route) => route.fulfill({ status: 200, contentType: 'application/json', body: text }));
  await commitOnMain(gh, `site/comments/${name}`, text, 'Seed comments');
}

/** Selects `text` inside `scope` with a DOM selection (across inline markup), as a reader's drag would. */
export async function selectText(scope: Locator, text: string): Promise<void> {
  await scope.first().evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let all = '';
    const starts: number[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { starts.push(all.length); nodes.push(n as Text); all += (n as Text).data; }
    const at = all.indexOf(wanted);
    if (at < 0) throw new Error(`"${wanted}" is not on the page`);
    const locate = (i: number) => { let k = 0; while (k + 1 < nodes.length && starts[k + 1]! <= i) k++; return { node: nodes[k]!, offset: i - starts[k]! }; };
    const s = locate(at);
    const e = locate(at + wanted.length - 1);
    const range = document.createRange();
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset + 1);
    (s.node.parentElement ?? root).scrollIntoView({ block: 'center' });
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }, text);
}

/** Center of the first line of `text` inside `scope`, in viewport coordinates (null when it is not shown). */
export async function textPoint(scope: Locator, text: string): Promise<{ x: number; y: number }> {
  const p = await scope.first().evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      const at = t.data.indexOf(wanted);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(t, at);
      range.setEnd(t, at + wanted.length);
      const rect = range.getClientRects()[0];
      if (rect && rect.width) { (t.parentElement ?? root).scrollIntoView({ block: 'center' }); const r = range.getClientRects()[0]!; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    }
    return null;
  }, text);
  if (!p) throw new Error(`"${text}" is not shown on the page`);
  return p;
}

/** The texts painted by the comment highlight (CSS Custom Highlight API), in page order. */
export const highlighted = (page: Page): Promise<string[]> => page.evaluate(() => {
  const h = (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get('platform-comment');
  return h ? [...h].map((r) => r.toString()) : [];
});

/** How many on-screen boxes the highlight paints (0 when its text is in a hidden tab). */
export const highlightBoxes = (page: Page): Promise<number> => page.evaluate(() => {
  const h = (CSS as unknown as { highlights?: Map<string, Set<Range>> }).highlights?.get('platform-comment');
  return h ? [...h].reduce((n, r) => n + [...r.getClientRects()].filter((b) => b.width > 0).length, 0) : 0;
});

/** Signs in for comments through Edit, then leaves the editor (one sign-in serves both). */
export async function signInThroughEdit(page: Page): Promise<void> {
  await editButton(page).click();
  await signInWithToken(page);
  await expect(body(page)).toBeVisible();
  await button(page, 'Cancel').click();
  await expect(editing(page)).toHaveCount(0);
  await expect(commentsButton(page)).toBeVisible();
}
