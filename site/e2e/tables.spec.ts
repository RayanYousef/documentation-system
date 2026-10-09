// Tables: insert with the size picker, type in cells, add rows and columns, align a column, delete a column.
// Saved, reloaded, opened again; the page and the saved GFM table are both checked.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, body, caretAfter, fileOnMain, toolbarButton, saveReloadAndEdit } from './support';

const PAGE = 'site/docs/getting-started.md';

async function newParagraph(page: Page): Promise<void> {
  await caretAfter(page, 'Skyforge targets');
  await page.keyboard.press('Enter');
}

async function insertTable(page: Page, rows: number, cols: number): Promise<void> {
  await toolbarButton(page, 'Table').click();
  await page.getByRole('menuitem', { name: 'Table', exact: true }).hover();
  const cell = page.getByTestId(`table-picker-${rows}x${cols}`);
  await cell.hover();
  await cell.click();
  await expect(body(page).locator('table')).toHaveCount(1);
}

async function tableMenu(page: Page, group: 'Row' | 'Column', item: string): Promise<void> {
  await toolbarButton(page, 'Table').click();
  await page.getByRole('menuitem', { name: group, exact: true }).hover();
  await page.getByRole('menuitem', { name: item }).click();
}

/** The lines of the first GFM table in a saved page, spaces around the pipes squeezed. */
const tableLines = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('|')).map((l) => l.replace(/\s+/g, ' '));

const table = (page: Page) => body(page).locator('table');
const rows = (page: Page) => table(page).locator('tr');
// Every row starts with an empty chrome cell (the row handle); the header row's real cells are th.
const cellsOfFirstRow = (page: Page) => rows(page).first().locator('th');

test('insert a 2 x 3 table, fill the cells, add a row and a column; saved as a GFM table', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await insertTable(page, 2, 3);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).first().locator('th')).toHaveCount(3);

  // The caret starts in the first cell; Tab moves to the next.
  for (const t of ['Item', 'Slots', 'Stack', 'Sword', '1']) { await page.keyboard.type(t); await page.keyboard.press('Tab'); }
  await page.keyboard.type('no');

  await tableMenu(page, 'Column', 'Insert column after');
  await expect(cellsOfFirstRow(page)).toHaveCount(4);
  await tableMenu(page, 'Row', 'Insert row after');
  await expect(rows(page)).toHaveCount(3);

  await saveReloadAndEdit(page);
  const text = fileOnMain(gh, PAGE)!;
  expect(tableLines(text)).toEqual(['| Item | Slots | Stack | |', '|---|---|---|---|', '| Sword | 1 | no | |', '| | | | |']);
  await expect(table(page)).toHaveCount(1);
  await expect(rows(page)).toHaveCount(3);
  await expect(cellsOfFirstRow(page)).toHaveCount(4);
  await expect(table(page).locator('th', { hasText: 'Slots' })).toHaveCount(1);
  await expect(table(page).locator('td', { hasText: 'Sword' })).toHaveCount(1);
});

test('rows and columns can be added before and after, and deleted', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await insertTable(page, 2, 2);
  await page.keyboard.type('A'); await page.keyboard.press('Tab');
  await page.keyboard.type('B'); await page.keyboard.press('Tab');
  await page.keyboard.type('a1'); await page.keyboard.press('Tab');
  await page.keyboard.type('b1');

  await tableMenu(page, 'Row', 'Insert row after');
  await expect(rows(page)).toHaveCount(3);
  await tableMenu(page, 'Column', 'Insert column before');
  await expect(cellsOfFirstRow(page)).toHaveCount(3);
  await tableMenu(page, 'Row', 'Delete row');
  await expect(rows(page)).toHaveCount(2);
  // Put the caret in the empty column that was inserted, and delete that one.
  await cellsOfFirstRow(page).nth(1).click();
  await tableMenu(page, 'Column', 'Delete column');
  await expect(cellsOfFirstRow(page)).toHaveCount(2);

  await saveReloadAndEdit(page);
  expect(tableLines(fileOnMain(gh, PAGE)!).slice(0, 2)).toEqual(['| A | B |', '|---|---|']);
  await expect(rows(page)).toHaveCount(2);
  await expect(cellsOfFirstRow(page)).toHaveCount(2);
});

test('a column can be aligned; saved as :---: and read back', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await insertTable(page, 2, 2);
  await page.keyboard.type('Left'); await page.keyboard.press('Tab');
  await page.keyboard.type('Middle');
  await tableMenu(page, 'Column', 'Align center');
  await saveReloadAndEdit(page);
  expect(tableLines(fileOnMain(gh, PAGE)!)[1]).toBe('|---|:---:|');
  await expect(table(page).locator('th', { hasText: 'Middle' })).toHaveCount(1);
});

test('Delete table removes it; the saved page has no table', async ({ page, gh }) => {
  await openEditor(page, 'getting-started');
  await newParagraph(page);
  await insertTable(page, 2, 2);
  await page.keyboard.type('gone');
  await toolbarButton(page, 'Table').click();
  await page.getByRole('menuitem', { name: 'Delete table' }).click();
  await expect(table(page)).toHaveCount(0);
  await saveReloadAndEdit(page);
  expect(fileOnMain(gh, PAGE)).not.toContain('gone');
});
