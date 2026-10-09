import { test, expect, openEditor, button, caretAfter, commitMessages, editButton } from './support';

test('Cancel with unsaved edits asks; No keeps editing, Yes restores the page and commits nothing', async ({ page, gh }) => {
  const before = commitMessages(gh).length;
  await openEditor(page, 'systems/inventory');
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(' Draft words.');

  page.once('dialog', (d) => { expect(d.message()).toBe('You have unsaved changes. Discard them?'); void d.dismiss(); });
  await button(page, 'Cancel').click();
  await expect(page.locator('[data-platform-editing]')).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await button(page, 'Cancel').click();
  await expect(page.locator('[data-platform-editing]')).toHaveCount(0);
  await expect(page.getByText('Draft words.')).toHaveCount(0);
  await expect(page.locator('article h1').first()).toHaveText('Inventory');
  await expect(editButton(page)).toBeVisible();
  expect(commitMessages(gh).length).toBe(before);
});

test('leaving through a site link with unsaved edits asks first', async ({ page, gh: _gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory (draft)');
  const url = page.url();

  page.once('dialog', (d) => { expect(d.message()).toBe('You have unsaved changes. Discard them?'); void d.dismiss(); });
  await page.locator('.theme-doc-sidebar-menu a', { hasText: 'Combat' }).click();
  await expect(page.locator('[data-platform-editing]')).toBeVisible();
  expect(page.url()).toBe(url);

  page.once('dialog', (d) => void d.accept());
  await page.locator('.theme-doc-sidebar-menu a', { hasText: 'Combat' }).click();
  await expect(page).toHaveURL(/systems\/combat$/);
  await expect(page.locator('article h1').first()).toHaveText('Combat');
});

test('closing or reloading the tab with unsaved edits triggers the browser prompt', async ({ page, gh: _gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory (draft)');
  const dialog = page.waitForEvent('dialog');
  void page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.dismiss();
});
