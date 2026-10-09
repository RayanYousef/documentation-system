import { test, expect, editButton, button, signInWithToken, body, TOKENS } from './support';

test('first Edit asks for a token; bad and read-only tokens are refused; a good one is remembered until Sign out', async ({ page, gh: _gh, consoleGuard }) => {
  consoleGuard.allow(/Failed to load resource: the server responded with a status of 401/);
  await page.goto('systems/inventory');
  await editButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Sign in to edit' });
  await expect(dialog).toContainText('fine-grained personal access token');
  await expect(dialog.getByLabel('Remember on this device')).toBeChecked();

  await signInWithToken(page, 'not-a-token');
  await expect(dialog.getByRole('alert')).toContainText('GitHub rejected the token');

  await signInWithToken(page, TOKENS.reader);
  await expect(dialog.getByRole('alert')).toContainText('not a write collaborator');

  await signInWithToken(page, TOKENS.writer);
  await expect(body(page)).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // Remembered: a reload and a new Edit go straight to the editor.
  await button(page, 'Cancel').click();
  await page.reload();
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sign in to edit' })).toHaveCount(0);

  // Sign out: the next Edit asks again.
  await button(page, 'Page actions').click();
  await expect(page.getByRole('menu')).toContainText('Signed in as Mira Okonkwo');
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Signed out.' })).toBeVisible();
  await editButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Sign in to edit' })).toBeVisible();
});
