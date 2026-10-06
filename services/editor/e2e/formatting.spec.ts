// Formatting through the fixed toolbar, the floating toolbar, the "/" menu, tables and admonitions.
// Every test checks the Markdown that the content server wrote after Save.
import type { Page } from '@playwright/test';
import { expect, floatingToolbar, newParagraphAtEnd, openPage, openSubmenu, pickSubmenuItem, pointTo, richBody, subMenu, saveAndRead, seedPage, selectLeft, signIn, test, tool, unsaved } from './support.js';

async function openSeeded(page: Page, slug: string, body = 'Intro.\n'): Promise<string> {
  const pagePath = await seedPage(slug, body);
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page)).toContainText(body.trim().split('\n')[0]!);
  return pagePath;
}

async function blockType(page: Page, name: string): Promise<void> {
  await tool(page, 'Block type').click();
  await page.getByRole('menuitemradio', { name }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

test('block types from the toolbar: heading levels, bulleted and numbered lists, quote', async ({ page }) => {
  const pagePath = await openSeeded(page, 'blocks');

  await newParagraphAtEnd(page);
  await page.keyboard.type('Heading two');
  await blockType(page, 'Heading 2');
  await expect(richBody(page).getByRole('heading', { level: 2, name: 'Heading two' })).toBeVisible();

  await page.keyboard.press('Enter');
  await page.keyboard.type('Heading four');
  await blockType(page, 'Heading 4');
  await expect(richBody(page).getByRole('heading', { level: 4, name: 'Heading four' })).toBeVisible();

  await page.keyboard.press('Enter');
  await page.keyboard.type('Bullet one');
  await tool(page, 'Bulleted list').click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Bullet two');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // an empty item ends the list

  await page.keyboard.type('Number one');
  await tool(page, 'Numbered list').click();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Number two');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await page.keyboard.type('Quoted line');
  await blockType(page, 'Quote');
  await expect(richBody(page).locator('blockquote', { hasText: 'Quoted line' })).toBeVisible();
  await expect(unsaved(page)).toBeVisible();

  expect(await saveAndRead(page, pagePath, 'Block types')).toBe([
    '', 'Intro.', '', '## Heading two', '', '#### Heading four', '',
    '* Bullet one', '* Bullet two', '', '1. Number one', '2. Number two', '', '> Quoted line', '',
  ].join('\n'));
});

test('the toolbar menus show every item in full, and Block type shows the check mark on the current type', async ({ page }) => {
  await openSeeded(page, 'menus');
  await richBody(page).getByText('Intro.').click();
  for (const label of ['Block type', 'Table', 'Insert admonition', 'Insert component']) {
    await tool(page, label).click();
    const menu = page.getByRole('menu');
    await expect(menu, label).toBeVisible();
    // Nothing cut off on the right: the menu is as wide as its content, and every item sits inside it.
    const { clientWidth, scrollWidth } = await menu.evaluate((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    expect(scrollWidth, `${label} menu scrolls sideways`).toBeLessThanOrEqual(clientWidth);
    const box = await menu.boundingBox();
    if (!box) throw new Error(`${label} menu has no box`);
    for (const item of await menu.locator('[role^="menuitem"]').all()) {
      const ib = await item.boundingBox();
      if (!ib) throw new Error(`${label} item has no box`);
      expect(ib.x + ib.width, `${label}: "${await item.innerText()}" is cut off`).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
    if (label === 'Block type') {
      const current = menu.getByRole('menuitemradio', { name: 'Text', exact: true, checked: true });
      const check = current.locator(':scope > span:not([data-slot]) svg');
      await expect(check).toBeVisible();
      const cb = await check.boundingBox();
      if (!cb) throw new Error('check mark has no box');
      expect(cb.x + cb.width, 'check mark is cut off').toBeLessThanOrEqual(box.x + box.width);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu'), label).toHaveCount(0);
  }
});

test('Shift+Enter makes a line break in a paragraph and does nothing in a heading or a list item', async ({ page }) => {
  const pagePath = await openSeeded(page, 'soft-break', 'Intro.\n\n## Title\n\n* Item\n');
  await richBody(page).getByRole('heading', { name: 'Title' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type(' two');
  await richBody(page).getByText('Item').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type(' two');
  await richBody(page).getByText('Intro.').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Second line.');
  await expect(unsaved(page)).toBeVisible();
  expect(await saveAndRead(page, pagePath, 'Soft breaks')).toBe('\nIntro.\\\nSecond line.\n\n## Title two\n\n* Item two\n');
  // The saved page opens in the visual editor again (no Raw fallback).
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page).getByRole('heading', { name: 'Title two' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Raw MDX' })).toHaveCount(0);
});

test('marks from the toolbar: bold, italic, inline code, and a link', async ({ page }) => {
  const pagePath = await openSeeded(page, 'marks');

  await newParagraphAtEnd(page);
  // A mark on a selection; ArrowRight collapses it, and a second click turns the mark off for what comes next.
  await page.keyboard.type('Make this bold');
  await selectLeft(page, 4);
  await tool(page, 'Bold (Ctrl+B)').click();
  await expect(richBody(page).locator('strong', { hasText: 'bold' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await tool(page, 'Bold (Ctrl+B)').click();

  // A mark turned on at the cursor applies to what is typed next.
  await page.keyboard.type(', this ');
  await tool(page, 'Italic (Ctrl+I)').click();
  await page.keyboard.type('italic');
  await tool(page, 'Italic (Ctrl+I)').click();
  await expect(richBody(page).locator('em', { hasText: 'italic' })).toBeVisible();

  await page.keyboard.type(', run npm ci');
  await selectLeft(page, 6);
  await tool(page, 'Inline code (Ctrl+E)').click();
  await expect(richBody(page).locator('code', { hasText: 'npm ci' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await tool(page, 'Inline code (Ctrl+E)').click();

  // A link on the selected word.
  await page.keyboard.type(' and read the guide');
  await selectLeft(page, 5);
  await tool(page, 'Link').click();
  const url = page.getByPlaceholder('Paste link');
  await expect(url).toBeVisible();
  await url.fill('https://example.com/guide');
  await url.press('Enter');
  await expect(richBody(page).getByRole('link', { name: 'guide' })).toHaveAttribute('href', 'https://example.com/guide');

  expect(await saveAndRead(page, pagePath, 'Marks')).toBe(
    '\nIntro.\n\nMake this **bold**, this *italic*, run `npm ci` and read the [guide](https://example.com/guide)\n',
  );
});

test('inserts from the toolbar: image by URL, code block with a language, divider', async ({ page }) => {
  const pagePath = await openSeeded(page, 'inserts');
  await newParagraphAtEnd(page);
  await page.keyboard.type('Before the inserts.');

  // Image by URL: a dialog, nothing is uploaded. A site-relative src is previewed from the site.
  await tool(page, 'Insert image by URL').click();
  const dialog = page.getByRole('dialog', { name: 'Insert image by URL' });
  await dialog.getByLabel('URL').fill('/img/logo.png');
  await dialog.getByLabel('Alt text').fill('Site logo');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toHaveCount(0);
  const img = richBody(page).getByRole('img', { name: 'Site logo' });
  await expect(img).toHaveAttribute('src', '/CloudDocumentationPersonal/img/logo.png');
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // Code block: starts as ```text; the language picker sets bash.
  await tool(page, 'Insert code block').click();
  await page.keyboard.type('npm ci');
  const language = richBody(page).getByRole('combobox');
  await expect(language).toHaveText('Plain text');
  await language.click();
  await page.getByRole('option', { name: 'Bash' }).click();
  await expect(language).toHaveText('Bash');

  await tool(page, 'Insert thematic break').click();
  await expect(richBody(page).locator('hr')).toHaveCount(1);

  expect(await saveAndRead(page, pagePath, 'Inserts')).toBe([
    '', 'Intro.', '', 'Before the inserts.', '', '![Site logo](/img/logo.png)', '', '```bash', 'npm ci', '```', '', '---', '',
  ].join('\n'));
});

test('table: insert from the toolbar, type in cells, add a row and a column; saved as a GFM table', async ({ page }) => {
  const pagePath = await openSeeded(page, 'table');
  await newParagraphAtEnd(page);

  // The size picker: point at the 2 x 2 cell and click it.
  await tool(page, 'Table').click();
  await openSubmenu(page, 'Table');
  const size = page.getByTestId('table-picker-2x2');
  await pointTo(page, size, subMenu(page));
  await expect(page.getByText('2 x 2')).toBeVisible();
  await size.click();
  const table = richBody(page).locator('table');
  // Table cells are Slate elements; each row also has a non-editable drag-handle cell.
  const CELL = 'th[data-slate-node="element"], td[data-slate-node="element"]';
  const cell = (row: number, col: number) => table.locator('tr').nth(row).locator(CELL).nth(col);
  await expect(table.locator('tr')).toHaveCount(2);

  // The cursor starts in the first header cell; Tab moves to the next cell (a click would race Slate's selection).
  await page.keyboard.type('Stat');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Value');
  await expect(cell(0, 1)).toHaveText('Value');

  // A column after the cursor column.
  await pickSubmenuItem(page, 'Table', 'Column', 'Insert column after');
  await expect(table.locator('tr').nth(0).locator(CELL)).toHaveCount(3);
  await page.keyboard.press('Tab');
  await page.keyboard.type('Unit');
  await page.keyboard.press('Tab');
  await page.keyboard.type('hp');
  await page.keyboard.press('Tab');
  await page.keyboard.type('100');
  await expect(cell(0, 2)).toHaveText('Unit');
  await expect(cell(1, 1)).toHaveText('100');

  // A row after the cursor row.
  await pickSubmenuItem(page, 'Table', 'Row', 'Insert row after');
  await expect(table.locator('tr')).toHaveCount(3);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('mp');
  await page.keyboard.press('Tab');
  await page.keyboard.type('50');
  await expect(cell(2, 0)).toHaveText('mp');
  await expect(cell(2, 1)).toHaveText('50');

  expect(await saveAndRead(page, pagePath, 'Table')).toBe([
    '', 'Intro.', '', '| Stat | Value | Unit |', '|---|---|---|', '| hp | 100 | |', '| mp | 50 | |', '',
  ].join('\n'));
});

test('the "/" menu inserts a block', async ({ page }) => {
  const pagePath = await openSeeded(page, 'slash');
  await newParagraphAtEnd(page);
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  await page.keyboard.type('heading 3');
  await page.getByRole('option', { name: 'Heading 3' }).click();
  await expect(menu).toHaveCount(0);
  await page.keyboard.type('From the slash menu');
  await expect(richBody(page).getByRole('heading', { level: 3, name: 'From the slash menu' })).toBeVisible();

  await page.keyboard.press('Enter');
  await page.keyboard.type('/divider');
  await page.keyboard.press('Enter');
  await expect(richBody(page).locator('hr')).toHaveCount(1);

  expect(await saveAndRead(page, pagePath, 'Slash menu')).toBe('\nIntro.\n\n### From the slash menu\n\n---\n');
});

test('Escape closes the "/" menu typed at the start of a line that has text, and the "/" stays in that line', async ({ page }) => {
  const pagePath = await openSeeded(page, 'slash-escape', 'First line.\n\nSecond line.\n');
  const menu = page.getByRole('listbox');

  // At the very start of the page, and at the start of a later paragraph.
  for (const line of ['First line.', 'Second line.']) {
    await richBody(page).getByText(line, { exact: true }).click();
    await page.keyboard.press('Home');
    await page.keyboard.type('/');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(richBody(page).getByText(`/${line}`, { exact: true })).toBeVisible();
  }

  // Typing elsewhere goes there, not into the page.
  const filter = page.getByLabel('Filter pages');
  await filter.click();
  await filter.press('End');
  await page.keyboard.type('zzq');
  await expect(filter).toHaveValue(`${pagePath}zzq`);
  await expect(menu).toHaveCount(0);
  await expect(richBody(page)).not.toContainText('zzq');
  await expect(richBody(page).locator('[data-slate-node="element"]')).toHaveText(['/First line.', '/Second line.']);
});

test('Markdown shortcuts while typing, then Undo and Redo from the toolbar', async ({ page }) => {
  const pagePath = await openSeeded(page, 'shortcuts');
  await newParagraphAtEnd(page);
  await page.keyboard.type('## Shortcut heading');
  await expect(richBody(page).getByRole('heading', { level: 2, name: 'Shortcut heading' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('> Shortcut quote');
  await expect(richBody(page).locator('blockquote', { hasText: 'Shortcut quote' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('* Shortcut item');
  await expect(richBody(page).getByRole('listitem').filter({ hasText: 'Shortcut item' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.type('some **bold** text');
  await expect(richBody(page).locator('strong', { hasText: 'bold' })).toBeVisible();
  await expect(richBody(page)).toContainText('some bold text');

  // Undo takes the last typing back, Redo puts it back.
  await tool(page, 'Undo').click();
  await expect(richBody(page)).not.toContainText('some bold text');
  await tool(page, 'Redo').click();
  await expect(richBody(page)).toContainText('some bold text');

  expect(await saveAndRead(page, pagePath, 'Shortcuts')).toBe(
    '\nIntro.\n\n## Shortcut heading\n\n> Shortcut quote\n\n* Shortcut item\n\nsome **bold** text\n',
  );
});

test('the To-do list button makes a task item', async ({ page }) => {
  const pagePath = await openSeeded(page, 'todo');
  await newParagraphAtEnd(page);
  await tool(page, 'To-do list').click();
  await page.keyboard.type('Task');
  await expect(richBody(page).getByRole('checkbox')).toHaveCount(1);
  expect(await saveAndRead(page, pagePath, 'To-do')).toBe('\nIntro.\n\n* [ ] Task\n');
});

test('the floating toolbar appears over a text selection and applies a mark', async ({ page }) => {
  const pagePath = await openSeeded(page, 'floating', 'Pick one word here.\n');
  const floating = floatingToolbar(page);
  await expect(floating).toHaveCount(0);

  await richBody(page).getByText('Pick one word here.').dblclick({ position: { x: 5, y: 5 } });
  await expect(floating).toBeVisible();
  await floating.getByLabel('Italic (Ctrl+I)', { exact: true }).click();
  await expect(richBody(page).locator('em', { hasText: 'Pick' })).toBeVisible();

  // Collapsing the selection hides it again.
  await page.keyboard.press('End');
  await expect(floating).toHaveCount(0);

  expect(await saveAndRead(page, pagePath, 'Floating toolbar')).toBe('\n*Pick* one word here.\n');
});

test('admonitions: insert one from the toolbar and edit the text of an existing one', async ({ page }) => {
  const pagePath = await openSeeded(page, 'admonition', 'Intro.\n\n:::note\nOld note text.\n:::\n\nOutro.\n');

  // Edit the existing :::note.
  await richBody(page).getByText('Old note text.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Extra words.');
  await expect(richBody(page).getByText('Old note text. Extra words.')).toBeVisible();

  // Insert a :::tip after the last paragraph and type in it.
  await richBody(page).getByText('Outro.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Done.');
  await tool(page, 'Insert admonition').click();
  await page.getByRole('menuitem', { name: ':::tip' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.type('A new tip.');
  await expect(richBody(page).getByText('A new tip.')).toBeVisible();

  // Leave the tip (Ctrl+Enter) and insert a :::note after it.
  await page.keyboard.press('Control+Enter');
  await tool(page, 'Insert admonition').click();
  await page.getByRole('menuitem', { name: ':::note' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.type('A new note.');
  await expect(richBody(page).getByText('A new note.')).toBeVisible();

  // Each admonition shows its type above its text.
  const callouts = richBody(page).locator('.slate-callout');
  await expect(callouts).toHaveCount(3);
  await expect(callouts.nth(0).locator('[contenteditable="false"]').first()).toHaveText(/^note$/i);
  await expect(callouts.nth(1).locator('[contenteditable="false"]').first()).toHaveText(/^tip$/i);
  await expect(callouts.nth(2).locator('[contenteditable="false"]').first()).toHaveText(/^note$/i);

  expect(await saveAndRead(page, pagePath, 'Admonitions')).toBe(
    '\nIntro.\n\n:::note\nOld note text. Extra words.\n:::\n\nOutro. Done.\n\n:::tip\nA new tip.\n:::\n\n:::note\nA new note.\n:::\n',
  );
});
