// What a person sees when GitHub refuses or cannot be reached: a token that cannot write is stopped at
// sign-in, and every refusal during a save has a plain message while the edits stay on the page for a retry.
import { test, expect, openEditor, clickEdit, signInWithToken, body, save, caretAfter, editStatus, fileOnMain, commitMessages, TOKENS } from './support';

const PAGE = 'site/docs/systems/inventory.md';
const dialog = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Sign in to edit' });

async function typeEdit(page: import('@playwright/test').Page, text: string): Promise<void> {
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(text);
  await expect(page.locator('.ped-dirty')).toBeVisible();
}

test.describe('sign-in proves the token can write', () => {
  test('a token without Contents: write is refused at sign-in with the fix and a link; nothing is committed', async ({ page, gh, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: the server responded with a status of 403/);
    const before = commitMessages(gh).length;
    await clickEdit(page, 'systems/inventory');
    await signInWithToken(page, TOKENS.noContents);
    const alert = dialog(page).getByRole('alert');
    await expect(alert).toContainText('This token can read the repo but cannot write to it. Give it Repository permissions → Contents: Read and write.');
    await expect(alert.getByRole('link', { name: 'Create your token' })).toHaveAttribute('href', /\/platform\/editor#create-your-token$/);
    await expect(body(page)).toHaveCount(0);
    expect(commitMessages(gh).length).toBe(before);
    // The refused token is not remembered: after a reload the dialog asks again.
    await page.reload();
    await page.getByTestId('inplace-edit-button').click();
    await expect(dialog(page)).toBeVisible();
  });

  test('a good token still signs in, and the write check leaves the repo unchanged', async ({ page, gh }) => {
    const before = commitMessages(gh);
    await openEditor(page, 'systems/inventory');
    expect(commitMessages(gh)).toEqual(before);
  });

  test('a lost connection during the write check is not reported as "cannot write"', async ({ page, faults, gh: _gh, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource/);
    faults.writesOffline = true;
    await clickEdit(page, 'systems/inventory');
    await signInWithToken(page);
    const alert = dialog(page).getByRole('alert');
    await expect(alert).toContainText('GitHub is unreachable');
    await expect(alert).not.toContainText('cannot write');
  });

  test('the "Create your token" link points at the docs section that exists', async ({ page, gh: _gh }) => {
    await page.goto('platform/editor');
    await expect(page.locator('#create-your-token')).toHaveCount(1);
    await expect(page.locator('#create-your-token')).toContainText('Create your token');
    await expect(page.locator('article')).toContainText('Contents: Read and write');
  });
});

test.describe('a failed save explains itself and keeps the edits', () => {
  test('401 during a save: the token expired or was revoked; the edits stay and a new attempt works after signing in again', async ({ page, gh, faults, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: the server responded with a status of 401/);
    await openEditor(page, 'systems/inventory');
    await typeEdit(page, ' First draft.');
    faults.revoked.add(TOKENS.writer);
    await save(page);
    await expect(editStatus(page)).toContainText('Your GitHub token has expired or was revoked');
    await expect(editStatus(page)).not.toContainText('HTTP 401');
    await expect(body(page)).toContainText('First draft.');
    await expect(page.locator('.ped-dirty')).toBeVisible();
    expect(fileOnMain(gh, PAGE)).not.toContain('First draft.');

    // The token works again (for example a new one was issued): the same edits save.
    faults.clear();
    await save(page);
    await expect(page.getByTestId('saved-banner')).toBeVisible();
    expect(fileOnMain(gh, PAGE)).toContain('First draft.');
  });

  test('403 on a write: the token cannot write; the message says how to fix it and the edits stay', async ({ page, gh, faults, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: the server responded with a status of 403/);
    await openEditor(page, 'systems/inventory');
    await typeEdit(page, ' Edited with a token that lost its permission.');
    faults.writeFault = { status: 403, message: 'Resource not accessible by personal access token' };
    await save(page);
    await expect(editStatus(page)).toContainText('This token can read the repo but cannot write to it');
    await expect(editStatus(page)).toContainText('Contents: Read and write');
    await expect(editStatus(page)).not.toContainText('HTTP 403');
    await expect(body(page)).toContainText('Edited with a token that lost its permission.');
    expect(fileOnMain(gh, PAGE)).not.toContain('lost its permission');

    faults.clear();
    await save(page);
    await expect(page.getByTestId('saved-banner')).toBeVisible();
    expect(fileOnMain(gh, PAGE)).toContain('lost its permission');
  });

  test('rate limit: the message says to wait and for how long; the retry works afterwards', async ({ page, gh, faults, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: the server responded with a status of 403/);
    await openEditor(page, 'systems/inventory');
    await typeEdit(page, ' Rate limited.');
    faults.rateLimit(120);
    await save(page);
    await expect(editStatus(page)).toContainText('rate limit');
    await expect(editStatus(page)).toContainText('Wait about 2 minutes');
    await expect(editStatus(page)).not.toContainText('cannot write');
    await expect(body(page)).toContainText('Rate limited.');

    faults.clear();
    await save(page);
    await expect(page.getByTestId('saved-banner')).toBeVisible();
    expect(fileOnMain(gh, PAGE)).toContain('Rate limited.');
  });

  test('protected branch: the message names the branch; the edits stay; no commit lands', async ({ page, gh, faults, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: the server responded with a status of 403/);
    const before = commitMessages(gh).length;
    await openEditor(page, 'systems/inventory');
    await typeEdit(page, ' Behind a branch rule.');
    faults.protectBranch('main');
    await save(page);
    await expect(editStatus(page)).toContainText('The branch "main" is protected');
    await expect(editStatus(page)).not.toContainText('cannot write');
    await expect(body(page)).toContainText('Behind a branch rule.');
    expect(commitMessages(gh).length).toBe(before);
    expect(fileOnMain(gh, PAGE)).not.toContain('Behind a branch rule.');
  });

  test('a lost connection during a save says GitHub is unreachable and keeps the edits', async ({ page, faults, gh: _gh, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource/);
    await openEditor(page, 'systems/inventory');
    await typeEdit(page, ' Offline edit.');
    faults.writesOffline = true;
    await save(page);
    await expect(editStatus(page)).toContainText('GitHub unreachable');
    await expect(body(page)).toContainText('Offline edit.');
  });
});
