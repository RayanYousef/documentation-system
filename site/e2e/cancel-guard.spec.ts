import { test, expect, openEditor, button, caretAfter, commitMessages, editButton, body } from './support';

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

test('edits discarded by leaving through a site link do not come back on the next Edit', async ({ page, gh: _gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory (draft)');
  page.once('dialog', (d) => void d.accept());
  await page.locator('.theme-doc-sidebar-menu a', { hasText: 'Combat' }).click();
  await expect(page).toHaveURL(/systems\/combat$/);

  await page.locator('.theme-doc-sidebar-menu a', { hasText: /^Inventory$/ }).click();
  await expect(page).toHaveURL(/systems\/inventory$/);
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
  await expect(page.getByLabel('Page title')).toHaveValue('Inventory');
  await expect(page.getByText('Restored your unsaved edits')).toHaveCount(0);
});

test('jumping to a heading of the page being edited does not ask', async ({ page, gh: _gh }) => {
  let asked = false;
  page.on('dialog', (d) => { asked = true; void d.dismiss(); });
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory (draft)');
  await page.locator('.table-of-contents a', { hasText: 'Service API' }).click();
  await expect(page).toHaveURL(/systems\/inventory#service-api$/);
  await expect(page.locator('[data-platform-editing]')).toBeVisible();
  await expect(page.getByLabel('Page title')).toHaveValue('Inventory (draft)');
  expect(asked).toBe(false);
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
