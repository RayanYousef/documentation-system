// Two saves in a row within a minute (the live site has a 60 second HTTP cache on GitHub reads), a save of a
// different page right after, and a save after Raw edits. Every save must be on top of the one before it.
import { test, expect, openEditor, body, caretAfter, save, fileOnMain, commitMessages, editButton, bundleOnMain } from './support';
import { generateBundle } from '@platform/okf-core';
import platform from '../../platform.config.js';

const INVENTORY = 'site/docs/systems/inventory.md';

test('two saves of the same page within a minute: the second starts from the first, both are kept', async ({ page, gh }) => {
  const before = commitMessages(gh).length;
  await openEditor(page, 'systems/inventory');
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(' First edit.');
  await page.getByLabel('Commit message').fill('First save');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();

  // Straight away (no reload): edit the same page again.
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
  await expect(body(page)).toContainText('First edit.'); // the editor opened on the saved text, not on a stale copy
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(' Second edit.');
  await page.getByLabel('Commit message').fill('Second save');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toContainText('Saved as');

  const text = fileOnMain(gh, INVENTORY)!;
  expect(text).toContain('First edit. Second edit.');
  const messages = commitMessages(gh);
  expect(messages.length).toBe(before + 2);
  expect(messages.slice(0, 2)).toEqual(['Second save', 'First save']);
  expect((fileOnMain(gh, 'site/docs/log.md')!.match(/Inventory\]\(\/systems\/inventory\.md\) - (First|Second) save/g) ?? []).length).toBe(2);

  // Nothing generated is stale after two saves.
  const files = bundleOnMain(gh);
  const gen = generateBundle(files, { codeRepos: platform.codeRepos });
  expect(gen.problems).toEqual([]);
  for (const [p, t] of Object.entries(gen.writes)) expect(t, `${p} is stale`).toBe(files[p]);
});

test('three saves in a row, the last after a reload: every edit is there', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  for (const n of [1, 2, 3]) {
    if (n === 3) { await page.reload(); await editButton(page).click(); await expect(body(page)).toBeVisible(); }
    else if (n === 2) { await editButton(page).click(); await expect(body(page)).toBeVisible(); }
    await caretAfter(page, 'An inventory is a fixed-size array');
    await page.keyboard.type(` Edit ${n}.`);
    await save(page);
    await expect(page.getByTestId('saved-banner')).toBeVisible();
  }
  expect(fileOnMain(gh, INVENTORY)).toContain('Edit 1. Edit 2. Edit 3.');
});

test('saving one page and then another keeps both pages and the log', async ({ page, gh }) => {
  await openEditor(page, 'systems/inventory');
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(' Inventory note.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();

  await page.goto('getting-started'); // already signed in: Edit goes straight to the editor
  await editButton(page).click();
  await expect(body(page)).toBeVisible();
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.type(' Started note.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();

  expect(fileOnMain(gh, INVENTORY)).toContain('Inventory note.');
  expect(fileOnMain(gh, 'site/docs/getting-started.md')).toContain('Started note.');
  const log = fileOnMain(gh, 'site/docs/log.md')!;
  expect(log).toContain('/systems/inventory.md');
  expect(log).toContain('/getting-started.md');
});
