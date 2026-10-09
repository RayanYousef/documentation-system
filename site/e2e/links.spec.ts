// Links: add (toolbar, markdown shortcut, pasted URL), edit and remove. Each is saved, the page is reloaded and
// the editor opened again; the page and the saved MDX are both checked.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

// The insert and the edit popovers both exist in the page; the one in use is the last.
const linkInput = (page: Page) => page.getByPlaceholder('Paste link').last();
const textInput = (page: Page) => page.getByPlaceholder('Text to display').last();

test('add a link to selected text with the Link button; saved as [text](url) and kept after a reload', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('Read the changelog');
  const line = body(page).locator('p', { hasText: 'Read the changelog' });
  await line.dblclick({ position: { x: 90, y: 10 } }); // the word "changelog"
  await toolbarButton(page, 'Link').click();
  await linkInput(page).fill('https://example.com/changelog');
  await page.keyboard.press('Enter');

  await expect(line.locator('a')).toHaveAttribute('href', 'https://example.com/changelog');
  await expect(line.locator('a')).toHaveText('changelog');

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/Read the \[changelog\]\(https:\/\/example\.com\/changelog\)/);
  await expect(body(page).locator('a[href="https://example.com/changelog"]')).toHaveText('changelog');
});

test('typing [text](url) and typing a bare URL followed by a space both become links', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('See [the guide](https://example.com/guide) and also https://example.org/plain ');
  const line = body(page).locator('p', { hasText: 'See' }).filter({ hasText: 'and also' });
  await expect(line.locator('a[href="https://example.com/guide"]')).toHaveText('the guide');
  await expect(line.locator('a[href="https://example.org/plain"]')).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('[the guide](https://example.com/guide)');
  expect(text).toMatch(/https:\/\/example\.org\/plain/);
  await expect(body(page).locator('a[href="https://example.com/guide"]')).toHaveCount(1);
});

test('edit a link: change its address and its text from the floating link toolbar', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('Go [here](https://example.com/old) now');
  const link = body(page).locator('a[href="https://example.com/old"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await page.getByRole('button', { name: 'Edit link' }).click();
  await linkInput(page).fill('https://example.com/new');
  await textInput(page).fill('over there');
  await page.keyboard.press('Enter');
  await expect(body(page).locator('a[href="https://example.com/new"]')).toHaveText('over there');
  await expect(body(page).locator('a[href="https://example.com/old"]')).toHaveCount(0);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('[over there](https://example.com/new)');
  expect(text).not.toContain('https://example.com/old');
  await expect(body(page).locator('a[href="https://example.com/new"]')).toHaveText('over there');
});

test('remove a link: the text stays, the link is gone from the page and from the saved file', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('Keep [this word](https://example.com/drop) please');
  const link = body(page).locator('a[href="https://example.com/drop"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await page.locator('button:has(svg.lucide-unlink)').click();
  await expect(body(page).locator('a[href="https://example.com/drop"]')).toHaveCount(0);
  await expect(body(page).locator('p', { hasText: 'Keep this word please' })).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('Keep this word please');
  expect(text).not.toContain('example.com/drop');
  await expect(body(page).locator('p', { hasText: 'Keep this word please' })).toHaveCount(1);
});

test('a link to another docs page is saved with its relative address', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('Next: [Save System](systems/save-system.md) here');
  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('[Save System](systems/save-system.md)');
  await expect(body(page).locator('a', { hasText: 'Save System' })).toHaveCount(1);
});
