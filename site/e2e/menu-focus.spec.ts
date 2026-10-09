// Typing straight after a pick from a toolbar menu (block type, admonition). The menu kept the keyboard focus
// through its close animation, and a mouse move over the closing menu pulled the focus back into it, so the first
// keystrokes after the pick were lost. These tests type at once, with no wait for the menu to close, then save
// and check the saved MDX.
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

/** Clicks `item`, then moves the mouse over `other` (another item of the same menu) and off the menu while it closes. */
async function pickAndWiggle(page: Page, item: Locator, other: Locator): Promise<void> {
  const box = (await other.boundingBox())!;
  await item.click();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width + 300, box.y + 200);
}

test('typing right after a block type pick lands in the new heading', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Block type').click();
  await page.getByRole('menuitemradio', { name: 'Heading 2' }).click();
  await page.keyboard.type('Typed at once');
  await expect(body(page).locator('h2', { hasText: 'Typed at once' })).toHaveText('Typed at once');

  await newParagraph(page);
  await toolbarButton(page, 'Block type').click();
  await pickAndWiggle(page, page.getByRole('menuitemradio', { name: 'Heading 3' }), page.getByRole('menuitemradio', { name: 'Heading 4' }));
  await page.keyboard.type('Typed while the mouse moves');
  await expect(body(page).locator('h3', { hasText: 'Typed while the mouse moves' })).toHaveText('Typed while the mouse moves');

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/^## Typed at once$/m);
  expect(fileOnMain(gh, PAGE)).toMatch(/^### Typed while the mouse moves$/m);
});

test('a settings popover opened right after a component menu pick stays open; its props are saved', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert component').click();
  await page.getByRole('menuitem', { name: 'FbxViewer' }).click();
  // At once, while the menu is still closing: the menu must not pull the focus back to the editor (that closes the popover).
  await body(page).locator('[data-docs-block="FbxViewer"]').getByRole('button', { name: 'FbxViewer settings' }).click();
  const repo = page.getByLabel('FbxViewer repo');
  await expect(repo).toBeVisible();
  await page.waitForTimeout(400); // longer than the menu's close animation
  await expect(repo).toBeVisible();
  await repo.fill('RayanYousef/documentation-system');
  await page.getByLabel('FbxViewer path').fill('examples/unity-project/Assets/Models/Chest.fbx');
  await page.keyboard.press('Escape');

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/<FbxViewer[^>]*repo="RayanYousef\/documentation-system"[^>]*path="examples\/unity-project\/Assets\/Models\/Chest\.fbx"[^>]*\/>/);
});

test('typing right after an admonition pick lands in the admonition', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert admonition').click();
  await page.getByRole('menuitem', { name: ':::tip' }).click();
  await page.keyboard.type('Tip typed at once.');
  await expect(body(page).locator('.theme-admonition-tip')).toContainText('Tip typed at once.');

  await newParagraph(page);
  await toolbarButton(page, 'Insert admonition').click();
  await pickAndWiggle(page, page.getByRole('menuitem', { name: ':::note' }), page.getByRole('menuitem', { name: ':::danger' }));
  await page.keyboard.type('Note typed while the mouse moves.');
  await expect(body(page).locator('.theme-admonition-note', { hasText: 'Note typed while the mouse moves.' })).toHaveCount(1); // the page has another note

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain(':::tip\nTip typed at once.\n:::');
  expect(fileOnMain(gh, PAGE)).toContain(':::note\nNote typed while the mouse moves.\n:::');
});
