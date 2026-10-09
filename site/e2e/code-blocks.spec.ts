// Code blocks: insert, several lines, the language picker, typing the ``` shortcut, and editing a block that is
// already on the page. Saved, reloaded, and checked on the page and in the saved MDX.
import type { Locator, Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, caretAtEnd, fileOnMain, toolbarButton, saveReloadAndEdit } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

/** Every code block of the page body. */
const blocks = (page: Page) => body(page).locator('.docs-code-block');

async function setLanguage(page: Page, block: Locator, label: string): Promise<void> {
  await block.getByRole('combobox').click();
  await page.getByPlaceholder('Search language...').fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('insert a code block, type several lines, pick C#; saved as a ```csharp fence and read back', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert code block').click();
  await page.keyboard.type('public class Inventory');
  await page.keyboard.press('Enter');
  await page.keyboard.type('{');
  await page.keyboard.press('Enter');
  await page.keyboard.type('  var tag = "<b>";');
  const block = blocks(page).filter({ hasText: 'public class Inventory' });
  await expect(block).toHaveCount(1);
  await expect(block.locator('.slate-code_line, [data-slate-node="element"]')).toHaveCount(3);
  await setLanguage(page, block, 'C#');
  await expect(block.getByRole('combobox')).toHaveText('C#');

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toContain('```csharp\npublic class Inventory\n{\n  var tag = "<b>";\n```');
  const again = blocks(page).filter({ hasText: 'public class Inventory' });
  await expect(again.getByRole('combobox')).toHaveText('C#');
  await expect(again).toContainText('var tag = "<b>";');
});

test('every language of the picker is written as its fence name', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const wanted: [string, string, string][] = [['Plain text', 'text', 'just text'], ['YAML', 'yaml', 'key: value'], ['Bash', 'bash', 'echo hi'], ['JSON', 'json', '{"a": 1}']];
  for (const [label, , code] of wanted) {
    await newParagraph(page);
    await toolbarButton(page, 'Insert code block').click();
    await page.keyboard.type(code);
    await setLanguage(page, blocks(page).filter({ hasText: code }), label);
    await expect(blocks(page).filter({ hasText: code }).getByRole('combobox')).toHaveText(label);
  }
  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  for (const [, fence, code] of wanted) expect(text, fence).toContain(`\`\`\`${fence}\n${code}\n\`\`\``);
  for (const [label, , code] of wanted) await expect(blocks(page).filter({ hasText: code }).getByRole('combobox')).toHaveText(label);
});

test('typing ``` starts a code block; text typed before it stays outside it', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('Before the block');
  await page.keyboard.press('Enter');
  await page.keyboard.type('```');
  await page.keyboard.type('npm run build');
  const block = blocks(page).filter({ hasText: 'npm run build' });
  await expect(block).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toMatch(/Before the block\n\n```[a-z]*\nnpm run build\n```/);
  await expect(blocks(page).filter({ hasText: 'npm run build' })).toHaveCount(1);
});

test('an existing code block can be edited: a line is added and its fence stays', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  const block = blocks(page).filter({ hasText: 'git clone https://github.com' });
  await expect(block).toHaveCount(1);
  await caretAtEnd(page, block.getByText('cd documentation-system/examples/unity-project'));
  await page.keyboard.press('Enter');
  await page.keyboard.type('git status');
  await expect(block).toContainText('git status');

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('git clone https://github.com/RayanYousef/documentation-system.git\ncd documentation-system/examples/unity-project\ngit status\n```');
  await expect(blocks(page).filter({ hasText: 'git status' })).toHaveCount(1);
});
