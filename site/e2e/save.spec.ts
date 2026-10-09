import { generateBundle, analyzeBundle, validateBundle } from '@platform/okf-core';
import platform from '../../platform.config.js';
import { test, expect, openEditor, body, save, caretAfter, fileOnMain, commitMessages, bundleOnMain, button } from './support';

const PAGE = 'site/docs/systems/inventory.md';

test('edit the body, save: one commit on main with the page, log entry and regenerated files; the page shows it until the deploy', async ({ page, gh }) => {
  const before = commitMessages(gh).length;
  await openEditor(page, 'systems/inventory');
  await caretAfter(page, 'An inventory is a fixed-size array');
  await page.keyboard.type(' Typed in place.');
  await expect(page.locator('.ped-dirty')).toBeVisible();
  await page.getByLabel('Commit message').fill('Explain inventory slots');
  await save(page);

  const banner = page.getByTestId('saved-banner');
  await expect(banner).toContainText('The public site updates after the deploy finishes');
  await expect(page.locator('[data-platform-editing]')).toHaveCount(0);

  const messages = commitMessages(gh);
  expect(messages.length).toBe(before + 1);
  expect(messages[0]).toBe('Explain inventory slots');
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('Typed in place.');
  expect(fileOnMain(gh, 'site/docs/log.md')).toMatch(/\[Inventory\]\(\/systems\/inventory\.md\) - Explain inventory slots\. \(by Mira Okonkwo\)/);

  // The committed tree is valid and nothing generated is stale.
  const files = bundleOnMain(gh);
  const gen = generateBundle(files, { codeRepos: platform.codeRepos });
  expect(gen.problems).toEqual([]);
  for (const [p, t] of Object.entries(gen.writes)) expect(t, `${p} is stale`).toBe(files[p]);
  expect(validateBundle(analyzeBundle(files), files, { codeRepos: platform.codeRepos })).toEqual([]);

  // The saved text is shown in place of the (older) built page, also after a reload.
  await expect(page.locator('.markdown').filter({ hasText: 'Typed in place.' }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await expect(page.locator('.markdown').filter({ hasText: 'Typed in place.' }).first()).toBeVisible();

  // A newer deploy (different build sha) retires the pending copy.
  await page.evaluate(() => {
    const key = 'docs-platform.pending-edits';
    const all = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    for (const k of Object.keys(all)) all[k].buildSha = 'newer-deploy';
    sessionStorage.setItem(key, JSON.stringify(all));
  });
  await page.reload();
  await expect(page.locator('article h1').first()).toHaveText('Inventory');
  await expect(page.getByTestId('saved-banner')).toHaveCount(0);
  await expect(page.getByText('Typed in place.')).toHaveCount(0);
  await expect(button(page, 'Edit')).toBeVisible();
  void body;
});

test('a pending save also expires after 15 minutes', async ({ page, gh: _gh }) => {
  await openEditor(page, 'systems/inventory');
  await page.getByLabel('Page title').fill('Inventory v2');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();
  await page.evaluate(() => {
    const key = 'docs-platform.pending-edits';
    const all = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    for (const k of Object.keys(all)) all[k].savedAt = Date.now() - 16 * 60 * 1000;
    sessionStorage.setItem(key, JSON.stringify(all));
  });
  await page.reload();
  await expect(page.locator('article h1').first()).toHaveText('Inventory');
  await expect(page.getByTestId('saved-banner')).toHaveCount(0);
});
