import { generateBundle } from '@platform/okf-core';
import platform from '../../platform.config.js';
import { test, expect, openEditor, button, save, fileOnMain, caretAfter, bundleOnMain } from './support';
import { splitFolderIntro } from '../../services/editor/src/mdx/folderIntro';

const INTRO = 'site/docs/systems/index.md';

test('a folder intro is edited in place; the generated index block stays read-only and is regenerated on save', async ({ page, gh }) => {
  const before = fileOnMain(gh, INTRO)!;
  await openEditor(page, 'systems/');
  await expect(page.getByLabel('Page title')).toHaveValue('Systems');
  await expect(button(page, 'Page settings')).toHaveCount(0);
  const okf = page.getByTestId('okf-generated');
  await expect(okf).toContainText('Inventory');
  await expect(okf.locator('xpath=ancestor-or-self::*[@contenteditable="false"]').first()).toBeAttached();

  await caretAfter(page, 'Runtime systems that make up');
  await page.keyboard.type(' Edited in place.');
  await save(page);
  await expect(page.getByTestId('saved-banner')).toBeVisible();

  const after = fileOnMain(gh, INTRO)!;
  expect(splitFolderIntro(after).before).toContain('Edited in place.');
  expect(splitFolderIntro(after).generated).toBe(splitFolderIntro(before).generated);
  const files = bundleOnMain(gh);
  expect(generateBundle(files, { codeRepos: platform.codeRepos }).writes[`systems/index.md`] ?? files['systems/index.md']).toBe(files['systems/index.md']);
});
