import { test, expect, openEditor, button, save, fileOnMain, commitOnMain, commitMessages } from './support';

const PAGE = 'site/docs/systems/inventory.md';

test('someone else changed the page: Save stops with a conflict, nothing is overwritten, Reload latest loads it', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory (mine)');
  const theirs = fileOnMain(gh, PAGE)!.replace('An inventory is a fixed-size array', 'An inventory (theirs) is a fixed-size array');
  await commitOnMain(gh, PAGE, theirs, 'Their edit');

  await save(page);
  const conflict = page.locator('.ped-conflict');
  await expect(conflict).toContainText('Someone else changed this page since you opened it.');
  await expect(button(page, 'Copy my version (Raw)')).toBeVisible();
  expect(fileOnMain(gh, PAGE)).toBe(theirs);
  expect(commitMessages(gh)[0]).toBe('Their edit');

  await button(page, 'Reload latest').click();
  await expect(conflict).toHaveCount(0);
  await expect(page.getByLabel('Page title')).toHaveValue('Inventory');
  await expect(page.locator('[data-slate-editor]')).toContainText('An inventory (theirs)');
});

test('another page changed meanwhile: the save is retried on the new head and keeps both changes', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory and stacks');
  const other = 'site/docs/systems/combat.md';
  await commitOnMain(gh, other, fileOnMain(gh, other)!.replace(/description: .*/, 'description: Describes how damage is dealt, changed meanwhile.'), 'Other page');

  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  expect(fileOnMain(gh, PAGE)).toContain('title: Inventory and stacks');
  const manifest = fileOnMain(gh, 'site/docs/manifest.json')!;
  expect(manifest).toContain('Inventory and stacks');
  expect(manifest).toContain('changed meanwhile');
});
