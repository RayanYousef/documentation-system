// Tabs: more than three tabs, rename (the tab props dialog), default tab, text and 3D models inside a tab,
// and reorder / remove through Raw (the visual editor has no buttons for those yet). Saved, reloaded, opened again.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, button, save, REPO_ROOT, editing } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

const tabsOf = (page: Page) => body(page).locator('.tabs-container');
const tabItems = (tabs: Locator) => tabs.locator('ul.tabs > li.tabs__item');
const panels = (tabs: Locator) => tabs.locator('[role="tabpanel"]');

/** Opens a tab's props (double-click) and sets one of them. */
async function setTabProp(page: Page, tabs: Locator, index: number, prop: 'label' | 'value', value: string): Promise<void> {
  await tabItems(tabs).nth(index).dblclick();
  await page.getByLabel(`TabItem ${prop}`).fill(value);
  await tabs.getByRole('button', { name: 'Done' }).click();
}

/** Writes text into the first paragraph of a tab's panel. */
async function typeInTab(tabs: Locator, page: Page, index: number, text: string): Promise<void> {
  await tabItems(tabs).nth(index).click();
  await expect(panels(tabs).nth(index)).toBeVisible();
  await panels(tabs).nth(index).locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

async function insertFourTabs(page: Page): Promise<Locator> {
  await newParagraph(page);
  await toolbarButton(page, 'Insert tabs').click();
  const tabs = tabsOf(page);
  await expect(tabs).toHaveCount(1);
  await tabs.getByRole('button', { name: 'Add tab' }).click();
  await tabs.getByRole('button', { name: 'Add tab' }).click();
  await expect(tabItems(tabs)).toHaveCount(4);
  for (const [i, name] of ['How to use', 'API', 'Misc', 'Extras'].entries()) await setTabProp(page, tabs, i, 'label', name);
  for (const [i, name] of ['use', 'api', 'misc', 'extras'].entries()) await setTabProp(page, tabs, i, 'value', name);
  return tabs;
}

test('four tabs: add, rename, write in each, make the third the default; saved in order and read back', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertFourTabs(page);
  await expect(tabItems(tabs)).toHaveText(['How to use', 'API', 'Misc', 'Extras']);
  for (const [i, text] of ['Steps go here.', 'Endpoints go here.', 'Odds and ends.', 'More extras.'].entries()) await typeInTab(tabs, page, i, text);

  // Default tab: the third.
  await tabItems(tabs).nth(2).dblclick();
  await page.getByLabel('TabItem default').check();
  await tabs.getByRole('button', { name: 'Done' }).click();

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  const order = [...text.matchAll(/<TabItem value="(\w+)" label="([^"]+)"( default)?>/g)].map((m) => `${m[1]}:${m[2]}${m[3] ? ':default' : ''}`);
  expect(order).toEqual(['use:How to use', 'api:API', 'misc:Misc:default', 'extras:Extras']);
  const api = text.slice(text.indexOf('<TabItem value="api"'), text.indexOf('<TabItem value="misc"'));
  expect(api).toContain('Endpoints go here.');

  // Read back by the editor: four tabs, the default one is showing.
  const again = tabsOf(page);
  await expect(tabItems(again)).toHaveText(['How to use', 'API', 'Misc', 'Extras']);
  await expect(again.locator('li.tabs__item--active')).toHaveText('Misc');
  await expect(panels(again).nth(2)).toContainText('Odds and ends.');
  await tabItems(again).nth(3).click();
  await expect(panels(again).nth(3)).toContainText('More extras.');
});

test('the saved page shows the same tabs, one panel at a time', async ({ page, gh: _gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertFourTabs(page);
  await typeInTab(tabs, page, 1, 'API text.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  const saved = page.locator('[data-platform-saved-preview] .tabs-container');
  await expect(tabItems(saved)).toHaveText(['How to use', 'API', 'Misc', 'Extras']);
  await expect(panels(saved).filter({ visible: true })).toHaveCount(1);
  await tabItems(saved).nth(1).click();
  await expect(panels(saved).nth(1)).toBeVisible();
  await expect(panels(saved).nth(1)).toContainText('API text.');
  await expect(panels(saved).nth(0)).toBeHidden();
});

test('a 3D model and text live inside a tab: an uploaded model, a repo FBX; saved inside the right TabItem', async ({ page, gh, consoleGuard }) => {
  // After the reload the site (not deployed yet) answers 404 for the uploaded model; the editor then reads it from GitHub.
  consoleGuard.allow(/Failed to load resource: the server responded with a status of 404/);
  await openEditor(page, 'getting-started');
  const tabs = await insertFourTabs(page);

  // Tab 2 ("API"): text, then an uploaded glTF model after it.
  await typeInTab(tabs, page, 1, 'The viewer below shows the API shape.');
  const chooser = page.waitForEvent('filechooser');
  await toolbarButton(page, 'Insert 3D model (.glb, .gltf, .fbx)').click();
  await (await chooser).setFiles({ name: 'api shape.gltf', mimeType: 'model/gltf+json', buffer: readFileSync(path.join(REPO_ROOT, 'site/static/models/cube.gltf')) });
  const inApi = panels(tabs).nth(1).locator('[data-docs-block="ModelViewer"]');
  await expect(inApi).toHaveCount(1);

  // Tab 3 ("Misc"): an FBX picked from the repository.
  await tabItems(tabs).nth(2).click();
  await panels(tabs).nth(2).locator('p').first().click();
  await toolbarButton(page, 'Insert from repo (existing models and images)').click();
  await page.getByRole('dialog', { name: 'Insert from repo' }).getByRole('button', { name: 'model: models/fbx/pyramid.fbx' }).click();
  const fbx = panels(tabs).nth(2).locator('[data-docs-block="FbxViewer"]');
  await expect(fbx).toHaveCount(1);
  await expect(fbx.locator('canvas')).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  const api = text.slice(text.indexOf('<TabItem value="api"'), text.indexOf('<TabItem value="misc"'));
  expect(api).toMatch(/The viewer below shows the API shape\.\s+<ModelViewer src="\/models\/api-shape\.gltf" alt="api-shape\.gltf" \/>\s+<\/TabItem>/);
  const misc = text.slice(text.indexOf('<TabItem value="misc"'), text.indexOf('<TabItem value="extras"'));
  expect(misc).toContain('<FbxViewer src="/models/fbx/pyramid.fbx" alt="pyramid.fbx" />');
  expect(gh.fileAt('main', 'site/static/models/api-shape.gltf')).toContain('"asset"');

  // The viewers are back in their own tabs when the editor opens the saved file.
  const again = tabsOf(page);
  await expect(panels(again).nth(1).locator('[data-docs-block="ModelViewer"]')).toHaveCount(1);
  await expect(panels(again).nth(2).locator('[data-docs-block="FbxViewer"]')).toHaveCount(1);
  void editing;
});

test('reorder and remove tabs through Raw: the order and the missing tab show in the visual editor and are saved', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const tabs = await insertFourTabs(page);
  for (const [i, text] of ['one', 'two', 'three', 'four'].entries()) await typeInTab(tabs, page, i, ` ${text}`);
  await saveReloadAndEdit(page);

  await button(page, 'Raw').click();
  const cm = page.locator('.cm-content');
  await expect(cm).toContainText('<Tabs>');
  const before = fileOnMain(gh, PAGE)!;
  // The first and the last tab swap places, the second is removed.
  const items = [...before.matchAll(/ {2}<TabItem[\s\S]*?<\/TabItem>\n/g)].map((m) => m[0]);
  expect(items.length).toBe(4);
  const start = before.indexOf(items[0]!);
  const end = before.indexOf(items[3]!) + items[3]!.length;
  const reordered = before.slice(0, start) + [items[3], items[2], items[0]].join('\n') + before.slice(end);
  await cm.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(reordered);
  await button(page, 'Visual').click();
  const edited = tabsOf(page);
  await expect(tabItems(edited)).toHaveText(['Extras', 'Misc', 'How to use']);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  const order = [...text.matchAll(/<TabItem value="(\w+)"/g)].map((m) => m[1]);
  expect(order).toEqual(['extras', 'misc', 'use']);
  expect(text).not.toContain('value="api"');
  await expect(tabItems(tabsOf(page))).toHaveText(['Extras', 'Misc', 'How to use']);
});
