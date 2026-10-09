import { test, expect, openEditor, button, fileOnMain, commitMessages } from './support';

const menu = async (page: import('@playwright/test').Page, item: string) => {
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: item }).click();
};

test('New page in this folder: path prefilled, one commit with the page, its index bullet, manifest and log', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  await menu(page, 'New page in this folder...');
  const dialog = page.getByRole('dialog', { name: 'New page' });
  await expect(dialog.getByLabel('New page path')).toHaveValue('systems/');
  await dialog.getByLabel('New page path').fill('systems/status-effects.md');
  await dialog.getByLabel('New page title').fill('Status Effects');
  await dialog.getByLabel('New page description').fill('Explains buffs and debuffs and how long they last.');
  await dialog.getByLabel('New page type').fill('system');
  await dialog.getByLabel('New page resource').fill('https://github.com/RayanYousef/documentation-system/blob/main/examples/unity-project/Assets/Scripts/Combat/DamagePipeline.cs');
  await button(page, 'Create').click();
  await expect(page.getByTestId('edit-status')).toContainText('Created systems/status-effects.md');
  expect(commitMessages(gh)[0]).toBe('Add systems/status-effects.md');
  expect(fileOnMain(gh, 'site/docs/systems/status-effects.md')).toContain('title: Status Effects');
  expect(fileOnMain(gh, 'site/docs/systems/index.md')).toContain('[Status Effects](status-effects.md)');
  expect(fileOnMain(gh, 'site/docs/manifest.json')).toContain('status-effects.md');
  expect(fileOnMain(gh, 'site/docs/log.md')).toContain('**Add**: [Status Effects](/systems/status-effects.md)');
});

test('Rename moves the page in one commit (delete + add) and regenerates the index', async ({ page, gh }) => {
  const before = commitMessages(gh).length;
  // A page no other page links to (renaming a linked page is refused by validation: broken links).
  await openEditor(page, 'decisions/2026-08-ecs-vs-monobehaviour');
  await menu(page, 'Rename...');
  const dialog = page.getByRole('dialog', { name: 'Rename page' });
  await dialog.getByLabel('New path').fill('decisions/ecs-or-monobehaviour.md');
  await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Renamed to decisions/ecs-or-monobehaviour.md' })).toBeVisible();
  expect(commitMessages(gh).length).toBe(before + 1);
  expect(fileOnMain(gh, 'site/docs/decisions/2026-08-ecs-vs-monobehaviour.md')).toBeNull();
  expect(fileOnMain(gh, 'site/docs/decisions/ecs-or-monobehaviour.md')).not.toBeNull();
  expect(fileOnMain(gh, 'site/docs/decisions/index.md')).toContain('(ecs-or-monobehaviour.md)');
});

test('Delete asks in a dialog, commits and goes to the folder page', async ({ page, gh }) => {
  await openEditor(page, 'assets/forge-props');
  await menu(page, 'Delete...');
  await page.getByRole('dialog', { name: 'Delete page' }).getByRole('button', { name: 'Delete page' }).click();
  await expect(page).toHaveURL(/\/assets\/$/);
  await expect(page.getByRole('status').filter({ hasText: 'Deleted assets/forge-props.md' })).toBeVisible();
  expect(commitMessages(gh)[0]).toBe('Delete assets/forge-props.md');
  expect(fileOnMain(gh, 'site/docs/assets/forge-props.md')).toBeNull();
  expect(fileOnMain(gh, 'site/docs/assets/index.md')).not.toContain('forge-props.md');
});

test('Publish version (writer, live mode) snapshots the docs and tags the commit', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await menu(page, 'Publish version...');
  const dialog = page.getByRole('dialog', { name: 'Publish a frozen version' });
  await dialog.getByLabel('Version').fill('1.1.0');
  await dialog.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('edit-status')).toContainText('Published 1.1.0 (tag docs-v1.1.0');
  expect(gh.tags()).toContain('docs-v1.1.0');
  expect(JSON.parse(fileOnMain(gh, 'site/versions.json')!)[0]).toBe('1.1.0');
  expect(fileOnMain(gh, 'site/versioned_docs/version-1.1.0/getting-started.md')).not.toBeNull();
});
