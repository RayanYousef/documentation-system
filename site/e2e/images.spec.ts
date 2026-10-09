// Images: inserted by URL and uploaded from disk. Each is saved, the page reloaded and the editor opened again;
// the page (image shown, props editable) and the saved MDX are both checked.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, commitMessages, REPO_ROOT } from './support';

const PAGE = 'site/docs/getting-started.md';
const LOGO = path.join(REPO_ROOT, 'site/static/img/logo.png');

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

/** True once the browser has decoded the image (so the file behind it is really a picture). */
const decoded = (img: Locator) => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);

test('insert an image by URL with alt text; its src and alt can be edited; saved as ![alt](src)', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert image by URL').click();
  const dialog = page.getByRole('dialog', { name: 'Insert image by URL' });
  await dialog.getByLabel('URL').fill('/documentation-system/img/logo.png');
  await dialog.getByLabel('Alt text').fill('The Skyforge logo');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toHaveCount(0);

  const img = body(page).locator('img[alt="The Skyforge logo"]');
  await expect(img).toHaveCount(1);
  await expect.poll(() => decoded(img)).toBe(true);

  // The fields under the image edit the node.
  await page.getByLabel('Image alt').fill('Skyforge emblem');
  await expect(body(page).locator('img[alt="Skyforge emblem"]')).toHaveCount(1);

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('![Skyforge emblem](/documentation-system/img/logo.png)');
  await expect(body(page).locator('img[alt="Skyforge emblem"]')).toHaveCount(1);
  await expect(page.getByLabel('Image src')).toHaveValue('/documentation-system/img/logo.png');
});

test('upload an image: committed to static/uploads at once, shown right away, saved with its site address', async ({ page, gh, consoleGuard }) => {
  // After the reload the site (not deployed yet) answers 404 for the new file; the editor then reads it from GitHub.
  consoleGuard.allow(/Failed to load resource: the server responded with a status of 404/);
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  const chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Upload image').click();
  await (await chooser).setFiles({ name: 'Flight Plan.png', mimeType: 'image/png', buffer: readFileSync(LOGO) });

  const img = body(page).locator('img[alt="Flight-Plan.png"]');
  await expect(img).toHaveCount(1);
  expect(commitMessages(gh)[0]).toBe('Add image Flight-Plan.png for getting-started.md');
  expect(gh.fileAt('main', 'site/static/uploads/Flight-Plan.png')).not.toBeNull();
  await expect(page.getByLabel('Image src')).toHaveValue('/documentation-system/uploads/Flight-Plan.png');
  await expect.poll(() => decoded(img)).toBe(true); // shown from the uploaded file; the site does not have it yet

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('![Flight-Plan.png](/documentation-system/uploads/Flight-Plan.png)');
  await expect.poll(() => decoded(body(page).locator('img[alt="Flight-Plan.png"]'))).toBe(true);
});

test('a file that is not an image is refused with a message and nothing is committed', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  const before = commitMessages(gh).length;
  const messages: string[] = [];
  page.once('dialog', (d) => { messages.push(d.message()); void d.accept(); });
  const chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Upload image').click();
  await (await chooser).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toMatch(/image|support/i);
  expect(commitMessages(gh).length).toBe(before);
});
