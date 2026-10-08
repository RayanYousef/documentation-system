// The page body: edit and save, untouched pages keep their bytes, Visual <-> Raw, the Raw fallback, save conflicts.
import { CURRENT_VERSION } from '@platform/contracts';
import { appStatus, backend, bodyOf, docFile, expect, git, newParagraphAtEnd, openPage, richBody, save, saveAndRead, seedPage, SEED_AUTHOR, signIn, test, unsaved } from './support.js';

/** A body with every construct the docs use, written the way the site's pages are written. */
const RICH_BODY = [
  '## Overview',
  '',
  'Text with **bold**, *italic*, ~~strike~~, `code` and a [link](combat.md).',
  '',
  '* First point',
  '  * Nested point',
  '* Second point',
  '',
  '1. One',
  '2. Two',
  '',
  '> A quoted line.',
  '',
  '---',
  '',
  '![Logo](/img/logo.png)',
  '',
  ':::note',
  'An admonition.',
  ':::',
  '',
  '```bash',
  'npm ci',
  '```',
  '',
  '| Key | Value |',
  '|:---|---:|',
  '| a | 1 |',
  '',
  '<ModelViewer src="/models/cube.gltf" alt="Sample cube" height={320} />',
  '',
  '<Tabs groupId="os">',
  '  <TabItem value="one" label="One" default>',
  '    First tab.',
  '  </TabItem>',
  '',
  '  <TabItem value="two" label="Two">',
  '    Second tab.',
  '  </TabItem>',
  '</Tabs>',
  '',
].join('\n');

test('typing in Visual mode makes the page dirty and Save writes the new paragraph as Markdown', async ({ page }) => {
  const pagePath = await seedPage('body-edit', 'Intro paragraph.\n');
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page)).toContainText('Intro paragraph.');
  await expect(unsaved(page)).toHaveCount(0);

  await newParagraphAtEnd(page);
  await page.keyboard.type('Added by the e2e test.');
  await expect(unsaved(page)).toBeVisible();

  expect(await saveAndRead(page, pagePath, 'Add a paragraph')).toBe('\nIntro paragraph.\n\nAdded by the e2e test.\n');
  expect(await git('log', '-1', '--format=%an')).toBe('Mock Editor');
  // After the save the editor shows the saved text and is clean.
  await expect(richBody(page)).toContainText('Added by the e2e test.');
  await expect(unsaved(page)).toHaveCount(0);
});

test('opening a rich page and moving around in it does not make it dirty, and saving it keeps every byte', async ({ page }) => {
  const pagePath = await seedPage('untouched', RICH_BODY);
  const before = await docFile(pagePath);
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page)).toContainText('An admonition.');
  await expect(page.getByLabel('ModelViewer src')).toHaveValue('/models/cube.gltf');

  await richBody(page).getByText('A quoted line.').click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await expect(unsaved(page)).toHaveCount(0);

  // Raw mode shows the file exactly as it was loaded.
  await page.getByRole('button', { name: 'Raw MDX' }).click();
  await expect(page.getByLabel('Raw MDX')).toHaveValue(before);
  await page.getByRole('button', { name: 'Visual' }).click();
  await expect(unsaved(page)).toHaveCount(0);

  await save(page, 'Save without changes');
  expect(await docFile(pagePath)).toBe(before);
});

test('one edit on a rich page re-exports every other construct byte for byte', async ({ page }) => {
  // The test above saves an untouched page, which returns the loaded bytes without exporting.
  // Here the browser editor really exports the whole page after one small edit.
  const pagePath = await seedPage('rich-edit', RICH_BODY);
  await signIn(page);
  await openPage(page, pagePath);
  await richBody(page).getByText('A quoted line.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' More');
  await expect(unsaved(page)).toBeVisible();
  expect(await saveAndRead(page, pagePath, 'Edit a rich page')).toBe('\n' + RICH_BODY.replace('> A quoted line.', '> A quoted line. More'));
});

test('switching Visual -> Raw -> Visual keeps body and frontmatter edits, and an edit made in Raw is saved', async ({ page }) => {
  const pagePath = await seedPage('raw-switch', 'First paragraph.\n');
  await signIn(page);
  await openPage(page, pagePath);

  await page.locator('label.row', { hasText: 'title' }).locator('input').fill('Raw Switch Title');
  await newParagraphAtEnd(page);
  await page.keyboard.type('Typed in Visual.');

  await page.getByRole('button', { name: 'Raw MDX' }).click();
  const raw = page.getByLabel('Raw MDX');
  await expect(raw).toHaveValue(/title: Raw Switch Title/);
  await expect(raw).toHaveValue(/\n\nFirst paragraph\.\n\nTyped in Visual\.\n$/);

  // Back to Visual: nothing is lost.
  await page.getByRole('button', { name: 'Visual' }).click();
  await expect(richBody(page)).toContainText('Typed in Visual.');
  await expect(page.locator('label.row', { hasText: 'title' }).locator('input')).toHaveValue('Raw Switch Title');

  // Edit in Raw and save from Raw.
  await page.getByRole('button', { name: 'Raw MDX' }).click();
  const value = await raw.inputValue();
  await raw.fill(value.replace('Typed in Visual.', 'Typed in Visual, then changed in Raw with **bold**.'));
  await expect(unsaved(page)).toBeVisible();
  await save(page, 'Edit in raw');
  const saved = await docFile(pagePath);
  expect(saved).toContain('title: Raw Switch Title');
  expect(bodyOf(saved)).toBe('\nFirst paragraph.\n\nTyped in Visual, then changed in Raw with **bold**.\n');

  // The Raw edit shows in Visual as real formatting.
  await page.getByRole('button', { name: 'Visual' }).click();
  await expect(richBody(page).locator('strong', { hasText: 'bold' })).toBeVisible();
});

test.describe('a page the rich editor cannot parse', () => {
  test.use({ allowedConsoleErrors: [/^Rich text parse error/] });

  test('opens in Raw mode with a notice, and can still be edited and saved', async ({ page }) => {
    const pagePath = await seedPage('unparsable', 'Before.\n\n<UnknownWidget size={2} />\n');
    await signIn(page);
    await openPage(page, pagePath);
    await expect(appStatus(page)).toContainText('could not be opened in the visual editor');
    const raw = page.getByLabel('Raw MDX');
    await expect(raw).toBeVisible();
    await expect(raw).toHaveValue(/<UnknownWidget size=\{2\} \/>/);
    await expect(richBody(page)).toHaveCount(0);
    await expect(unsaved(page)).toHaveCount(0);

    await raw.fill((await raw.inputValue()).replace('Before.', 'Before, edited in Raw.'));
    await save(page, 'Edit unparsable page');
    expect(bodyOf(await docFile(pagePath))).toBe('\nBefore, edited in Raw.\n\n<UnknownWidget size={2} />\n');
  });

  test('the old ":::warning Title" admonition form opens in Raw, so the admonition is not escaped away', async ({ page }) => {
    // Docusaurus renders this as an admonition, but the rich editor would read it as plain text and save
    // it as "\:::warning ...", which removes the admonition from the site.
    const body = '## Setup\n\n:::warning Before you start\n\nBack up your save files.\n\n:::\n\nLAST paragraph.\n';
    const pagePath = await seedPage('old-admonition', body);
    await signIn(page);
    await openPage(page, pagePath);
    await expect(appStatus(page)).toContainText('could not be opened in the visual editor');
    const raw = page.getByLabel('Raw MDX');
    await expect(raw).toBeVisible();
    await expect(richBody(page)).toHaveCount(0);
    await expect(unsaved(page)).toHaveCount(0);

    await raw.fill((await raw.inputValue()).replace('LAST paragraph.', 'LAST! paragraph.'));
    await save(page, 'Edit old admonition page');
    expect(bodyOf(await docFile(pagePath))).toBe(`\n${body.replace('LAST paragraph.', 'LAST! paragraph.')}`);
  });
});

test('a change saved behind the editor\'s back makes Save fail with the conflict message', async ({ page }) => {
  const pagePath = await seedPage('conflict', 'Original text.\n');
  await signIn(page);
  await openPage(page, pagePath);

  // Someone else saves the page after the editor loaded it.
  const theirs = await backend.readPage(CURRENT_VERSION, pagePath);
  await backend.writePage(CURRENT_VERSION, pagePath, theirs.text.replace('Original text.', 'Their text.'), { message: 'Their change', author: SEED_AUTHOR, expectedEtag: theirs.etag });

  await newParagraphAtEnd(page);
  await page.keyboard.type('My text.');
  await page.getByLabel('Commit message').fill('My change');
  await page.getByRole('button', { name: 'Save & commit' }).click();
  await expect(appStatus(page)).toContainText(`${pagePath} changed since you loaded it`);
  await expect(unsaved(page)).toBeVisible();
  expect(await git('log', '-1', '--format=%s')).toBe('Their change');
  expect(bodyOf(await docFile(pagePath))).toBe('\nTheir text.\n');
});
