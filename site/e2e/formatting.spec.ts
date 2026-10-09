// The formatting toolbar: marks, headings, lists, quote, undo and redo. Each test edits getting-started, saves,
// reloads, and checks the page (the saved copy and the editor opened again) and the saved MDX on the fake main.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit, button } from './support';

const PAGE = 'site/docs/getting-started.md';

/** An empty paragraph after the first one, with the caret in it. */
async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

async function blockType(page: Page, name: string): Promise<void> {
  await toolbarButton(page, 'Block type').click();
  await page.getByRole('menuitemradio', { name }).click();
  // The menu hands the focus back to the editor when it has closed; typing before that is lost.
  await expect(page.getByRole('menuitemradio', { name })).toHaveCount(0);
  await expect(body(page)).toBeFocused();
}

test('marks: bold, italic, underline, strikethrough and inline code from the toolbar and from shortcuts', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);

  await page.keyboard.type('Plain ');
  await toolbarButton(page, 'Bold (Ctrl+B)').click();
  await page.keyboard.type('bolder');
  await toolbarButton(page, 'Bold (Ctrl+B)').click();
  await page.keyboard.type(' and ');
  await toolbarButton(page, 'Italic (Ctrl+I)').click();
  await page.keyboard.type('slanted');
  await toolbarButton(page, 'Italic (Ctrl+I)').click();
  await page.keyboard.type(' and ');
  await toolbarButton(page, 'Underline (Ctrl+U)').click();
  await page.keyboard.type('underlined');
  await toolbarButton(page, 'Underline (Ctrl+U)').click();
  await page.keyboard.type(' and ');
  await toolbarButton(page, 'Strikethrough').click();
  await page.keyboard.type('struck');
  await toolbarButton(page, 'Strikethrough').click();
  await page.keyboard.type(' and ');
  await toolbarButton(page, 'Inline code (Ctrl+E)').click();
  await page.keyboard.type('npm start');
  await toolbarButton(page, 'Inline code (Ctrl+E)').click();
  await page.keyboard.type(' and ');
  await page.keyboard.press('Control+B');
  await page.keyboard.type('shortcut');
  await page.keyboard.press('Control+B');

  const line = body(page).locator('p', { hasText: 'Plain' });
  await expect(line.locator('strong', { hasText: 'bolder' })).toHaveCount(1);
  await expect(line.locator('em, i', { hasText: 'slanted' })).toHaveCount(1);
  await expect(line.locator('u', { hasText: 'underlined' })).toHaveCount(1);
  await expect(line.locator('del, s', { hasText: 'struck' })).toHaveCount(1);
  await expect(line.locator('code', { hasText: 'npm start' })).toHaveCount(1);
  await expect(line.locator('strong', { hasText: 'shortcut' })).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('Plain **bolder** and ');
  expect(text).toMatch(/(\*|_)slanted\1/);
  expect(text).toContain('<u>underlined</u>');
  expect(text).toContain('~~struck~~');
  expect(text).toContain('`npm start`');
  expect(text).toContain('**shortcut**');
  // Read back from the saved file by the editor.
  const again = body(page).locator('p', { hasText: 'Plain' });
  await expect(again.locator('strong', { hasText: 'bolder' })).toHaveCount(1);
  await expect(again.locator('code', { hasText: 'npm start' })).toHaveCount(1);
});

test('marks apply to a selection, and toggling them off removes them', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('select this phrase now');
  const line = body(page).locator('p', { hasText: 'select this phrase now' });
  await line.dblclick({ position: { x: 100, y: 10 } }); // selects the word "phrase"
  await toolbarButton(page, 'Bold (Ctrl+B)').click();
  await expect(line.locator('strong')).toHaveText(/^phrase\s*$/);
  await toolbarButton(page, 'Italic (Ctrl+I)').click();
  await expect(line.locator('em, i')).toHaveCount(1);
  await toolbarButton(page, 'Italic (Ctrl+I)').click(); // off again
  await expect(line.locator('em, i')).toHaveCount(0);

  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/select this \*\*phrase\*\* now/);
  await expect(body(page).locator('p', { hasText: 'select this' }).locator('strong')).toHaveText(/^phrase\s*$/);
});

test('headings 1 to 4 and quote from the block type menu; saved as # and >', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  for (const [name, hashes, text] of [['Heading 2', '##', 'Second level'], ['Heading 3', '###', 'Third level'], ['Heading 4', '####', 'Fourth level']] as const) {
    await newParagraph(page);
    await blockType(page, name);
    await page.keyboard.type(text);
    await expect(body(page).locator(`h${hashes.length}`, { hasText: text })).toHaveCount(1);
  }
  await newParagraph(page);
  await blockType(page, 'Quote');
  await page.keyboard.type('Quoted wisdom.');
  await expect(body(page).locator('blockquote', { hasText: 'Quoted wisdom.' })).toHaveCount(1);
  await expect(toolbarButton(page, 'Block type')).toHaveText('Quote');

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toMatch(/^## Second level$/m);
  expect(text).toMatch(/^### Third level$/m);
  expect(text).toMatch(/^#### Fourth level$/m);
  expect(text).toMatch(/^> Quoted wisdom\.$/m);
  await expect(body(page).locator('h3', { hasText: 'Third level' })).toHaveCount(1);
  await expect(body(page).locator('blockquote', { hasText: 'Quoted wisdom.' })).toHaveCount(1);
});

test('a heading can be turned back into text, and markdown shortcuts ("## ") make headings while typing', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await page.keyboard.type('## Typed heading');
  await expect(body(page).locator('h2', { hasText: 'Typed heading' })).toHaveCount(1);
  await blockType(page, 'Text');
  await expect(body(page).locator('h2', { hasText: 'Typed heading' })).toHaveCount(0);
  await expect(body(page).locator('p', { hasText: 'Typed heading' })).toHaveCount(1);
  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toContain('\nTyped heading\n');
  expect(text).not.toContain('## Typed heading');
});

test('bulleted, numbered and to-do lists; saved as -, 1. and - [ ]', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Bulleted list').click();
  await page.keyboard.type('apple');
  await page.keyboard.press('Enter');
  await page.keyboard.type('pear');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leaves the list
  await toolbarButton(page, 'Numbered list').click();
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await toolbarButton(page, 'To-do list').click();
  await page.keyboard.type('write tests');

  await expect(body(page).locator('p[class*="slate-indent"]', { hasText: 'apple' })).toHaveCount(1);
  await expect(body(page).locator('p[class*="slate-indent"]', { hasText: 'second' })).toHaveCount(1);
  await expect(body(page).locator('p[class*="slate-indent"]', { hasText: 'write tests' })).toHaveCount(1);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(text).toMatch(/^[-*] apple\n[-*] pear$/m);
  expect(text).toMatch(/^1\. first\n2\. second$/m);
  expect(text).toMatch(/^[-*] \[ \] write tests$/m);
  await expect(body(page).locator('p[class*="slate-indent"]', { hasText: 'pear' })).toHaveCount(1);
  await expect(body(page).locator('p[class*="slate-indent"]', { hasText: 'write tests' })).toHaveCount(1);
});

test('Tab indents a list item into a nested list', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Bulleted list').click();
  await page.keyboard.type('parent');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('child');
  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/^[-*] parent\n {2,4}[-*] child$/m);
});

test('undo and redo: the buttons and the keyboard walk back and forward through typing and formatting', async ({ page, gh: _gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  const undo = toolbarButton(page, 'Undo');
  const redo = toolbarButton(page, 'Redo');
  const mine = body(page).locator('p', { hasText: /^keep me/ });
  await page.keyboard.type('keep me');
  await page.keyboard.press('Control+B'); // bold on for the next characters
  await page.keyboard.type(' bold part');
  await expect(mine.locator('strong')).toHaveText(' bold part');
  await expect(redo).toBeDisabled();

  // The editor groups typing, so a click may undo a word or a whole run: press until nothing is left to undo.
  for (let i = 0; i < 10 && await undo.isEnabled(); i++) await undo.click();
  await expect(body(page)).not.toContainText('keep me');
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  for (let i = 0; i < 10 && await redo.isEnabled(); i++) await redo.click();
  await expect(mine.locator('strong')).toHaveText(' bold part');
  await expect(mine).toContainText('keep me bold part');
  await expect(redo).toBeDisabled();

  // Keyboard: Ctrl+Z until the text is gone, Ctrl+Y until it is back.
  for (let i = 0; i < 10 && await undo.isEnabled(); i++) await page.keyboard.press('Control+Z');
  await expect(body(page)).not.toContainText('keep me');
  for (let i = 0; i < 10 && await redo.isEnabled(); i++) await page.keyboard.press('Control+Y');
  await expect(mine).toContainText('keep me bold part');
});

test('the divider button inserts a thematic break that is saved as ---', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await toolbarButton(page, 'Insert thematic break').click();
  await expect(body(page).locator('hr')).toHaveCount(1);
  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).toMatch(/^---$/m);
  await expect(body(page).locator('hr')).toHaveCount(1);
  void button;
});
