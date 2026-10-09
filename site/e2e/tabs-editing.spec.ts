// Editing tabs in the visual editor without Raw: rename a tab by clicking its label, add, move and remove tabs
// with the header buttons (any number of tabs), heading-style labels, and the "Feature page" template of New page.
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, button, commitMessages } from './support';

const PAGE = 'site/docs/getting-started.md';
const tabsOf = (page: Page) => body(page).locator('.tabs-container');
const tabItems = (tabs: Locator) => tabs.locator('ul.tabs > li.tabs__item');
const panels = (tabs: Locator) => tabs.locator('[role="tabpanel"]');
const nameBox = (tabs: Locator) => tabs.getByRole('textbox', { name: 'Tab name' });
const savedOrder = (text: string) => [...text.matchAll(/<TabItem value="([\w-]+)" label="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);

async function insertTabs(page: Page): Promise<Locator> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
  await toolbarButton(page, 'Insert tabs').click();
  const tabs = tabsOf(page);
  await expect(tabItems(tabs)).toHaveText(['One', 'Two']);
  return tabs;
}

/** Shows a tab (a click on a tab that is not shown only shows it). */
async function show(tabs: Locator, index: number): Promise<void> {
  const item = tabItems(tabs).nth(index);
  if (!/tabs__item--active/.test((await item.getAttribute('class')) ?? '')) await item.click();
  await expect(item).toHaveClass(/tabs__item--active/);
  await expect(nameBox(tabs)).toHaveCount(0);
}

test('rename a tab by clicking its label: Enter saves, Escape cancels; saved as the TabItem label', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertTabs(page);

  // A click on a tab that is not shown only shows it; a click on the shown tab turns its label into a text box.
  await show(tabs, 1);
  await tabItems(tabs).nth(1).click();
  await expect(nameBox(tabs)).toHaveValue('Two');
  await nameBox(tabs).fill('Linux');
  await page.keyboard.press('Escape');
  await expect(nameBox(tabs)).toHaveCount(0);
  await expect(tabItems(tabs)).toHaveText(['One', 'Two']);

  await tabItems(tabs).nth(1).click();
  await nameBox(tabs).fill('Linux');
  await page.keyboard.press('Enter');
  await expect(nameBox(tabs)).toHaveCount(0);
  await expect(tabItems(tabs)).toHaveText(['One', 'Linux']);

  // The first tab too, then save and read back.
  await show(tabs, 0);
  await tabItems(tabs).nth(0).click();
  await nameBox(tabs).fill('Windows');
  await page.keyboard.press('Enter');
  await expect(tabItems(tabs)).toHaveText(['Windows', 'Linux']);

  await saveReloadAndEdit(page);
  expect(savedOrder(fileOnMain(gh, PAGE)!)).toEqual(['one:Windows', 'two:Linux']);
  await expect(tabItems(tabsOf(page))).toHaveText(['Windows', 'Linux']);
});

test('add, move and remove tabs with the buttons: five tabs, reordered, one removed; saved in that order', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertTabs(page);
  for (let i = 0; i < 3; i++) await tabs.getByRole('button', { name: 'Add tab' }).click();
  await expect(tabItems(tabs)).toHaveText(['One', 'Two', 'Tab 3', 'Tab 4', 'Tab 5']);
  await expect(tabItems(tabs).nth(4)).toHaveClass(/tabs__item--active/); // a new tab is shown

  // Write in the fifth tab so its content can be followed.
  await panels(tabs).nth(4).locator('p').first().click();
  await page.keyboard.type('Fifth tab text.');

  // The shown tab (Tab 5) moves left twice; the first tab moves right once. Left at the start is disabled.
  await tabs.getByRole('button', { name: 'Move tab left' }).click();
  await tabs.getByRole('button', { name: 'Move tab left' }).click();
  await expect(tabItems(tabs)).toHaveText(['One', 'Two', 'Tab 5', 'Tab 3', 'Tab 4']);
  await expect(tabItems(tabs).nth(2)).toHaveClass(/tabs__item--active/);
  await expect(panels(tabs).nth(2)).toContainText('Fifth tab text.');
  await show(tabs, 0);
  await expect(tabs.getByRole('button', { name: 'Move tab left' })).toBeDisabled();
  await tabs.getByRole('button', { name: 'Move tab right' }).click();
  await expect(tabItems(tabs)).toHaveText(['Two', 'One', 'Tab 5', 'Tab 3', 'Tab 4']);

  // Remove "Tab 3".
  await show(tabs, 3);
  await tabs.getByRole('button', { name: 'Remove tab' }).click();
  await expect(tabItems(tabs)).toHaveText(['Two', 'One', 'Tab 5', 'Tab 4']);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(savedOrder(text)).toEqual(['two:Two', 'one:One', 'tab5:Tab 5', 'tab4:Tab 4']);
  expect(text.slice(text.indexOf('<TabItem value="tab5"'), text.indexOf('<TabItem value="tab4"'))).toContain('Fifth tab text.');
  await expect(tabItems(tabsOf(page))).toHaveText(['Two', 'One', 'Tab 5', 'Tab 4']);
});

test('the last tab cannot be removed', async ({ page, gh: _gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertTabs(page);
  await tabs.getByRole('button', { name: 'Remove tab' }).click();
  await expect(tabItems(tabs)).toHaveCount(1);
  await expect(tabs.getByRole('button', { name: 'Remove tab' })).toBeDisabled();
});

test('tab labels look like an H3 heading in the editor', async ({ page, gh: _gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertTabs(page);
  const sizes = await page.evaluate(() => {
    const h3 = document.createElement('h3');
    document.querySelector('[data-platform-editing] .markdown')!.append(h3);
    const size = getComputedStyle(h3).fontSize;
    h3.remove();
    return size;
  });
  await expect(tabItems(tabs).first()).toHaveCSS('font-size', sizes);
});

test('New page offers Blank or Feature page; a Feature page starts with a title and tabs How to use, API and Misc', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  await button(page, 'Page actions').click();
  await page.getByRole('menuitem', { name: 'New page in this folder...' }).click();
  const dialog = page.getByRole('dialog', { name: 'New page' });
  await expect(dialog.getByRole('radio', { name: 'Blank' })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Feature page' }).check();
  await dialog.getByLabel('New page path').fill('systems/crafting.md');
  await dialog.getByLabel('New page title').fill('Crafting');
  await dialog.getByLabel('New page description').fill('How crafting turns items into other items; open it to change recipes.');
  await dialog.getByLabel('New page type').fill('system');
  await button(page, 'Create').click();
  await expect(page.getByTestId('edit-status')).toContainText('Created systems/crafting.md');
  expect(commitMessages(gh)[0]).toBe('Add systems/crafting.md');
  const text = fileOnMain(gh, 'site/docs/systems/crafting.md')!;
  expect(text).toContain('title: Crafting');
  expect(text).toContain('\n# Crafting\n\n<Tabs>\n');
  expect(savedOrder(text)).toEqual(['how-to-use:How to use', 'api:API', 'misc:Misc']);
  expect(text).toContain('<TabItem value="how-to-use" label="How to use" default>');
  for (const part of ['How to use', 'API', 'Misc']) expect(text).toMatch(new RegExp(`label="${part}"[^>]*>\\n {4}\\S`)); // each tab has a placeholder line
});
