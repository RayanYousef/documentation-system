// LIVE test against the real GitHub. Run it yourself:
//   $env:GITHUB_TOKEN = "<your fine-grained token>"      (PowerShell; this terminal only, never a file)
//   npm run e2e:live -w @platform/site
//
// It builds and serves the site from this checkout, signs in with the token (which proves the token can write),
// creates one temporary test page with the editor's "New page", and then on that page: saves, saves again within a
// minute, adds Tabs, adds an FBX model that is already in the repo, adds and then deletes a comment, and finally
// deletes the page again.
// Every step is a real commit to main and starts a Pages deploy. The token is only ever typed into the sign-in
// dialog; it is not printed or written anywhere.
import { test, expect, type Page } from '@playwright/test';

const TOKEN = process.env.GITHUB_TOKEN ?? '';
const PAGE = process.env.E2E_LIVE_PAGE ?? '';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const editorBody = (page: Page) => page.locator('[data-platform-editing] [data-slate-editor]');
const toolbarButton = (page: Page, label: string) => page.getByRole('toolbar', { name: 'Formatting', exact: true }).getByLabel(label, { exact: true });

/** Anything that could carry the token is scrubbed before it reaches a log. */
function scrub(e: unknown): Error {
  const message = String((e as Error)?.message ?? e).split(TOKEN).join('***');
  return new Error(message);
}

/**
 * Types the token and signs in. The token box is emptied before this returns, success or not: a failed `expect`
 * writes an aria snapshot of the page into test-results/**\/error-context.md, and that snapshot lists the value of
 * every text box. So no assertion may run while the token is in the box; this only waits for the outcome.
 */
async function signIn(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  const input = dialog.getByLabel('GitHub token');
  try {
    await input.focus();
    await page.keyboard.insertText(TOKEN); // not fill(): the call log of a failed fill would repeat the value
    await button(page, 'Sign in').click();
    await Promise.race([
      editorBody(page).waitFor({ timeout: 60_000 }),
      dialog.getByRole('alert').waitFor({ timeout: 60_000 }),
    ]).catch(() => { /* the assertions after the box is empty report what went wrong */ });
  } catch (e) {
    throw scrub(e);
  } finally {
    if (await input.count().catch(() => 0)) await input.fill('').catch(() => { /* the page is gone */ });
  }
}

/** Opens the editor on a page; signs in when the dialog asks (the first time). */
async function openEditor(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.getByTestId('inplace-edit-button').click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  const first = await Promise.race([
    dialog.waitFor().then(() => 'dialog'),
    editorBody(page).waitFor().then(() => 'editor'),
  ]);
  if (first === 'dialog') await signIn(page);
  await expect(editorBody(page)).toBeVisible();
}

async function saveAndWait(page: Page, commitMessage: string): Promise<void> {
  await page.getByLabel('Commit message').fill(commitMessage);
  await button(page, 'Save').click();
  await expect(page.getByTestId('saved-banner')).toContainText('Saved as');
}

/** Selects `text` in the page content with a DOM selection, as a reader's drag would. */
async function selectInPage(page: Page, text: string): Promise<void> {
  await page.locator('article .theme-doc-markdown').first().evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      const at = t.data.indexOf(wanted);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(t, at);
      range.setEnd(t, at + wanted.length);
      t.parentElement?.scrollIntoView({ block: 'center' });
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      return;
    }
    throw new Error(`"${wanted}" is not on the page`);
  }, text);
}

/** Hooks for steps added later. Each runs on the test page, signed in, after the last save (the saved version is shown). */
export const extraSteps: { name: string; run(page: Page): Promise<void> }[] = [
  {
    // A comment is a real commit of site/comments/<page>.json; deleting the last one removes the file again.
    name: 'comment: add a comment, see it after a reload, then resolve and delete it',
    async run(page) {
      const commentsButton = page.getByTestId('comments-button');
      await expect(commentsButton).toBeVisible();
      await selectInPage(page, 'First live save.');
      await button(page, 'Comment').click();
      const box = page.getByRole('dialog', { name: 'New comment' });
      await box.getByLabel('Comment').fill('Live e2e comment.');
      await box.getByRole('button', { name: 'Save' }).click();
      await expect(box).toHaveCount(0);
      await expect(commentsButton).toHaveAccessibleName('Comments (1 open)');

      // The deploy has not published it yet; this tab keeps showing it after a reload.
      await page.reload();
      await expect(commentsButton).toHaveAccessibleName('Comments (1 open)');

      // Resolve it from its card, then delete it for good from the Resolved tab.
      await commentsButton.click();
      const panel = page.getByRole('complementary', { name: 'Comments' });
      await panel.getByTestId('comment-item').getByRole('button').click();
      const card = page.getByRole('dialog', { name: 'Comment thread' });
      await expect(card).toContainText('Live e2e comment.');
      await card.getByRole('button', { name: 'Resolve' }).click();
      await expect(card).toHaveCount(0);
      await panel.getByRole('tab', { name: /^Resolved/ }).click();
      await panel.getByRole('button', { name: 'Delete' }).click();
      await panel.getByRole('alertdialog', { name: 'Delete this comment for good?' }).getByRole('button', { name: 'Delete for good' }).click();
      await expect(panel.getByText('No resolved comments.')).toBeVisible();
      await expect(commentsButton).toHaveAccessibleName('Comments');
    },
  },
];

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set.');
  if (!PAGE) throw new Error('E2E_LIVE_PAGE is not set (playwright.live.config.ts sets it).');
});

test('live: sign in, create a test page, save twice, add Tabs and an FBX model, comment, then delete the page', async ({ page }) => {
  // 1. Sign in (this makes the write check against the real repo) and create the temporary page.
  await openEditor(page, 'getting-started');
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: 'New page in this folder...' }).click();
  const dialog = page.getByRole('dialog', { name: 'New page' });
  await dialog.getByLabel('New page path').fill(`${PAGE}.md`);
  await dialog.getByLabel('New page title').fill('E2E live test');
  await dialog.getByLabel('New page description').fill('A temporary page made by the live end-to-end test; it deletes itself at the end.');
  await dialog.getByLabel('New page type').fill('guide');
  await button(page, 'Create').click();
  await expect(page.getByTestId('edit-status')).toContainText(`Created ${PAGE}.md`);
  await button(page, 'Cancel').click();

  // 2. First save on the new page. (The local site has a placeholder page at the same address; the editor
  //    reads and writes the real file on GitHub.)
  await openEditor(page, PAGE);
  await editorBody(page).locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' First live save.');
  await saveAndWait(page, 'Live e2e: first save');

  // 3. A second save within a minute, on top of the first.
  await page.getByTestId('inplace-edit-button').click();
  await expect(editorBody(page)).toContainText('First live save.');
  await editorBody(page).locator('p', { hasText: 'First live save.' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Second live save.');
  await saveAndWait(page, 'Live e2e: second save');

  // 4. Tabs.
  await page.getByTestId('inplace-edit-button').click();
  await expect(editorBody(page)).toContainText('Second live save.');
  await editorBody(page).locator('p', { hasText: 'Second live save.' }).click();
  await page.keyboard.press('End');
  await toolbarButton(page, 'Insert tabs').click();
  const tabs = editorBody(page).locator('.tabs-container');
  await expect(tabs).toHaveCount(1);
  await tabs.getByRole('button', { name: 'Add tab' }).click();
  await expect(tabs.locator('ul.tabs > li.tabs__item')).toHaveCount(3);
  await saveAndWait(page, 'Live e2e: add Tabs');
  await expect(page.locator('[data-platform-saved-preview] .tabs-container ul.tabs > li')).toHaveCount(3);

  // 5. An FBX model that is already in the repo.
  await page.getByTestId('inplace-edit-button').click();
  await expect(editorBody(page).locator('.tabs-container')).toHaveCount(1);
  await editorBody(page).locator('p', { hasText: 'First live save.' }).click();
  await toolbarButton(page, 'Insert from repo (existing models and images)').click();
  await page.getByRole('dialog', { name: 'Insert from repo' }).getByRole('button', { name: 'model: models/fbx/pyramid.fbx' }).click();
  const fbx = editorBody(page).locator('[data-docs-block="FbxViewer"]');
  await expect(fbx).toHaveCount(1);
  await expect(fbx.locator('canvas')).toHaveCount(1, { timeout: 60_000 });
  await expect(fbx).not.toContainText('Could not load');
  await saveAndWait(page, 'Live e2e: add an FBX model');

  // 6. Steps added later.
  for (const step of extraSteps) await test.step(step.name, () => step.run(page));

  // 7. Delete the test page again.
  await openEditor(page, PAGE);
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: 'Delete...' }).click();
  await page.getByRole('dialog', { name: 'Delete page' }).getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByRole('status').filter({ hasText: `Deleted ${PAGE}.md` })).toBeVisible();
});
