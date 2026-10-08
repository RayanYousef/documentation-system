// The editor around the page body: sign in, the file picker, frontmatter, the unsaved-changes guard,
// validation problems, create / rename / delete, and publishing a frozen version.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { appStatus, bodyOf, docFile, expect, git, openPage, pageText, repoPath, RESOURCE, richBody, save, seedPage, siteFile, signIn, test, unsaved } from './support.js';

const field = (page: Page, name: string) => page.locator('label.row', { hasText: new RegExp(`^${name}`) }).locator('input').first();

test('sign in with the mock provider; the file picker lists and filters pages and opens one', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Display name').fill('Picker Person');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Signed in as')).toContainText('Picker Person (editor)');
  await expect(page.getByText('Select a page or folder intro to start editing.')).toBeVisible();

  // Reserved files never appear as pages.
  await expect(page.getByRole('button', { name: 'systems/inventory.md', exact: true })).toBeVisible();
  for (const reserved of ['log.md', 'AGENTS.md', 'README.md']) await expect(page.getByRole('button', { name: reserved, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /code-maps\// })).toHaveCount(0);

  // The filter matches path or title.
  await page.getByLabel('Filter pages').fill('lag compensation');
  await expect(page.getByRole('button', { name: 'systems/networking/lag-compensation.md' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'systems/inventory.md', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'systems/networking/lag-compensation.md' }).click();
  await expect(page.getByRole('heading', { name: 'systems/networking/lag-compensation.md' })).toBeVisible();
  await expect(field(page, 'title')).toHaveValue('Lag Compensation');
  await expect(richBody(page)).toBeVisible();
  await expect(richBody(page).locator('table')).toBeVisible();
  await expect(unsaved(page)).toHaveCount(0);

  // Forget token signs out.
  await page.getByRole('button', { name: 'Forget token' }).click();
  await expect(page.getByLabel('Display name')).toBeVisible();
});

test('every frontmatter field can be edited and is saved; other keys and the body stay as they were', async ({ page }) => {
  const pagePath = await seedPage('frontmatter', 'Body that must not change.\n');
  await signIn(page, 'Form Filler');
  await openPage(page, pagePath);

  await field(page, 'title').fill('Front Matter Page');
  await expect(unsaved(page)).toBeVisible();
  await field(page, 'description').fill('Explains how the frontmatter form writes every field it shows.');
  await page.getByLabel('new type').fill('mechanic');
  await field(page, 'tags').fill('e2e, frontmatter');
  await field(page, 'resource').fill(`${RESOURCE}/Stages`);
  await field(page, 'sidebar_position').fill('7');

  await save(page, 'Edit every field');
  const saved = await docFile(pagePath);
  expect(saved).toBe([
    '---',
    'title: Front Matter Page',
    'description: Explains how the frontmatter form writes every field it shows.',
    'type: mechanic',
    'tags: [e2e, frontmatter]',
    `resource: ${RESOURCE}/Stages`,
    'sidebar_position: 7',
    '---',
    '',
    'Body that must not change.',
    '',
  ].join('\n'));
  expect(await git('log', '-1', '--format=%an %s')).toBe('Form Filler Edit every field');
  // The generated files follow the change.
  expect(await siteFile('docs/systems/index.md')).toContain(`[Front Matter Page](${pagePath.split('/').at(-1)}) - Explains how the frontmatter form writes every field it shows.`);
  expect(await siteFile('docs/manifest.json')).toContain('Explains how the frontmatter form writes every field it shows.');
  expect(await siteFile('docs/log.md')).toContain(`* **Update**: [Front Matter Page](/${pagePath}) - Edit every field. (by Form Filler)`);

  // The type dropdown offers the types in use, and picking one saves it.
  await page.getByLabel('type', { exact: true }).selectOption('guide');
  await save(page, 'Pick a listed type');
  expect(await docFile(pagePath)).toContain('\ntype: guide\n');
});

test('unsaved edits are guarded when another page is opened', async ({ page }) => {
  const first = await seedPage('guard-a', 'Guard page A.\n');
  const second = await seedPage('guard-b', 'Guard page B.\n');
  await signIn(page);
  await openPage(page, first);
  await field(page, 'description').fill('Draft edit that must not be lost.');
  await expect(unsaved(page)).toBeVisible();

  // Dismissing the confirm keeps the page and its edits.
  page.once('dialog', (d) => { expect(d.type()).toBe('confirm'); expect(d.message()).toBe('You have unsaved changes. Discard them?'); void d.dismiss(); });
  await page.getByLabel('Filter pages').fill(second);
  await page.getByRole('button', { name: second, exact: true }).click();
  await expect(page.getByRole('heading', { name: first })).toBeVisible();
  await expect(field(page, 'description')).toHaveValue('Draft edit that must not be lost.');

  // Accepting it opens the other page, clean.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: second, exact: true }).click();
  await expect(page.getByRole('heading', { name: second })).toBeVisible();
  await expect(richBody(page)).toContainText('Guard page B.');
  await expect(unsaved(page)).toHaveCount(0);
});

test('the problem list shows local and server validation problems, and nothing is committed until they are fixed', async ({ page }) => {
  const pagePath = await seedPage('problems', 'A page with problems to fix.\n');
  await signIn(page);
  await openPage(page, pagePath);
  const lastCommit = await git('log', '-1', '--format=%s');

  // Local check: a missing description.
  await field(page, 'description').fill('');
  await page.getByRole('button', { name: 'Save & commit' }).click();
  await expect(appStatus(page)).toContainText('Fix the problems below before saving.');
  const problems = page.getByRole('alert');
  await expect(problems).toContainText('Validation problems');
  await expect(problems).toContainText(`${pagePath} [frontmatter] missing "description"`);
  expect(await git('log', '-1', '--format=%s')).toBe(lastCommit);

  // Server check: a broken link (only the backend sees the other files).
  await field(page, 'description').fill('A page with problems to fix, now with a description again.');
  await page.getByRole('button', { name: 'Raw MDX' }).click();
  const raw = page.getByLabel('Raw MDX');
  await raw.fill((await raw.inputValue()).replace('A page with problems to fix.', 'See [a missing page](missing-page.md).'));
  await page.getByRole('button', { name: 'Save & commit' }).click();
  await expect(problems).toContainText('[link] broken link -> missing-page.md');
  await expect(appStatus(page)).toContainText('problem(s)');
  expect(await git('log', '-1', '--format=%s')).toBe(lastCommit);

  // Fixed: saved, and the list is gone.
  await raw.fill((await raw.inputValue()).replace('(missing-page.md)', '(combat.md)'));
  await save(page, 'Fix the link');
  await expect(problems).toHaveCount(0);
  expect(bodyOf(await docFile(pagePath))).toBe('\nSee [a missing page](combat.md).\n');
});

test('create a page in the New page dialog, then rename it and delete it', async ({ page }) => {
  const slug = `effects-${Math.random().toString(36).slice(2, 7)}`;
  const created = `systems/${slug}.md`;
  const renamed = `systems/${slug}-renamed.md`;
  await signIn(page);

  await page.getByRole('button', { name: 'New page' }).click();
  const dialog = page.getByRole('dialog', { name: 'New page' });
  await dialog.getByLabel('New page path').fill(created);
  await dialog.getByLabel('New page title').fill('Status Effects');
  await dialog.getByLabel('New page description').fill('Lists every status effect, its duration rules and which combat stage applies it.');
  await dialog.getByLabel('New page type').fill('system');
  await expect(dialog.getByLabel('New page resource')).toHaveValue(/^https:\/\/github\.com\/RayanYousef\/documentation-system\/blob\/main\//);
  await dialog.getByLabel('New page resource').fill(RESOURCE);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(appStatus(page)).toContainText(`Created ${created}`);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: created })).toBeVisible();
  await expect(richBody(page)).toContainText('Write the page here.');
  const createdText = pageText('Status Effects', '# Status Effects\n\nWrite the page here.\n')
    .replace('Seeded by the editor end-to-end tests so a test can change a page of its own.', 'Lists every status effect, its duration rules and which combat stage applies it.')
    .replace('tags: [e2e]\n', '');
  expect(await docFile(created)).toBe(createdText);
  expect(await siteFile('docs/systems/index.md')).toContain(`* [Status Effects](${slug}.md) - Lists every status effect`);

  // A second create on the same path stays in the dialog with the backend's message.
  await page.getByRole('button', { name: 'New page' }).click();
  await dialog.getByLabel('New page path').fill(created);
  await dialog.getByLabel('New page title').fill('Duplicate');
  await dialog.getByLabel('New page description').fill('Tries to reuse an existing path.');
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(`${created} already exists`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  // Rename (a prompt) commits and opens the new path.
  page.once('dialog', (d) => { expect(d.type()).toBe('prompt'); void d.accept(renamed); });
  await page.getByRole('button', { name: 'Rename' }).click();
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible();
  expect(await git('log', '-1', '--format=%s')).toBe(`Rename ${created} to ${renamed}`);
  await expect(page.getByRole('button', { name: created, exact: true })).toHaveCount(0);
  // On disk the file moved unchanged, and the rich editor loaded it again for the new path.
  expect(await docFile(renamed)).toBe(createdText);
  await expect(docFile(created)).rejects.toThrow();
  await expect(richBody(page)).toContainText('Write the page here.');

  // Delete (a confirm) commits and updates the folder index.
  page.once('dialog', (d) => { expect(d.type()).toBe('confirm'); void d.accept(); });
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(appStatus(page)).toContainText(`Deleted ${renamed}`);
  await expect(page.getByRole('button', { name: renamed, exact: true })).toHaveCount(0);
  expect(await git('log', '-1', '--format=%s')).toBe(`Delete ${renamed}`);
  await expect(docFile(renamed)).rejects.toThrow();
  expect(await siteFile('docs/systems/index.md')).not.toContain(slug);
});

test('publish a frozen version from the dialog; the frozen version is read-only', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Publish version' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish a frozen version' });
  const version = dialog.getByLabel('Version');
  await version.fill('1.0.0');
  await expect(dialog.getByText('Version 1.0.0 already exists.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await version.fill('1.1');
  await expect(dialog.getByText('Use the form major.minor.patch')).toBeVisible();
  await version.fill('1.1.0');
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(appStatus(page)).toContainText('Published 1.1.0 (tag docs-v1.1.0');
  await expect(dialog).toHaveCount(0);

  const repo = await repoPath();
  const frozen = await readFile(path.join(repo, 'site/versioned_docs/version-1.1.0/systems/inventory.md'), 'utf8');
  expect(frozen).toContain(`/blob/${'e'.repeat(40)}/examples/unity-project/Assets/Scripts/Inventory`);
  expect(frozen).not.toContain('/blob/main/');
  expect(JSON.parse(await siteFile('docs/versions/1.1.0.json')).pins['RayanYousef/documentation-system']).toBe('e'.repeat(40));
  expect((await git('tag', '--list')).split('\n')).toContain('docs-v1.1.0');
  expect(JSON.parse(await siteFile('versions.json'))).toContain('1.1.0');

  // The frozen version opens read-only: no toolbar, nothing editable, nothing to save.
  await page.getByLabel('Version').first().selectOption('1.1.0');
  await expect(page.getByText('This version is frozen and read-only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New page' })).toBeDisabled();
  await openPage(page, 'systems/inventory.md');
  await expect(page.getByRole('button', { name: 'Save & commit' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await expect(field(page, 'description')).toBeDisabled();
  const body = page.getByTestId('rich-text-body');
  await expect(body).toContainText('All mutations go through');
  await expect(body).not.toHaveAttribute('contenteditable', 'true');
  await expect(page.getByRole('toolbar', { name: 'Formatting', exact: true })).toHaveCount(0);
});
