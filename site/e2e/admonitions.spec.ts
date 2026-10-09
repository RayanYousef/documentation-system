// Admonitions: every type (:::note, tip, info, caution, danger) is inserted from the toolbar menu, typed into,
// saved, reloaded and read back. The page shows the site's own admonition; the saved MDX has the :::type fence.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, button } from './support';

const PAGE = 'site/docs/getting-started.md';
const VARIANTS = ['note', 'tip', 'info', 'caution', 'danger'] as const;

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

/** Inserts an admonition from the toolbar menu and waits until the caret is back in the editor (typing earlier is lost). */
async function insertAdmonition(page: Page, variant: string): Promise<void> {
  await toolbarButton(page, 'Insert admonition').click();
  await page.getByRole('menuitem', { name: `:::${variant}` }).click();
  await expect(page.getByRole('menuitem', { name: `:::${variant}` })).toHaveCount(0);
  await expect(body(page)).toBeFocused();
}

test('every admonition type can be inserted, typed into, saved and read back', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  for (const variant of VARIANTS) {
    await newParagraph(page);
    await insertAdmonition(page, variant);
    await page.keyboard.type(`A ${variant} for readers.`);
    const adm = body(page).locator(`.theme-admonition-${variant}`).filter({ hasText: `A ${variant} for readers.` });
    await expect(adm).toHaveCount(1);
  }

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  for (const variant of VARIANTS) {
    expect(text, variant).toContain(`:::${variant}\nA ${variant} for readers.\n:::`);
    await expect(body(page).locator(`.theme-admonition-${variant}`).filter({ hasText: `A ${variant} for readers.` }), variant).toHaveCount(1);
  }
});

test('an admonition holds several paragraphs, marks and a list', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await insertAdmonition(page, 'caution');
  await page.keyboard.type('First paragraph with ');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('bold');
  await page.keyboard.press('Control+B');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second paragraph.');
  await page.keyboard.press('Enter');
  await toolbarButton(page, 'Bulleted list').click();
  await page.keyboard.type('inside item');

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toMatch(/:::caution\nFirst paragraph with \*\*bold\*\*\n\nSecond paragraph\.\n\n[-*] inside item\n:::/);
  const adm = body(page).locator('.theme-admonition-caution');
  await expect(adm).toHaveCount(1);
  await expect(adm.locator('strong', { hasText: 'bold' })).toHaveCount(1);
  await expect(adm).toContainText('inside item');
});

test('an admonition with a title written in Raw is shown with the title and saved unchanged', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await cm.locator('.cm-line', { hasText: '## Prerequisites' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type(':::tip[Pro tip]');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Titled advice.');
  await page.keyboard.press('Enter');
  await page.keyboard.type(':::');
  await button(page, 'Visual').click();
  const adm = body(page).locator('.theme-admonition-tip');
  await expect(adm).toContainText('Pro tip');
  await expect(adm).toContainText('Titled advice.');

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain(':::tip[Pro tip]\nTitled advice.\n:::');
  await expect(body(page).locator('.theme-admonition-tip')).toContainText('Pro tip');
});
