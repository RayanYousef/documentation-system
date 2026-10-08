// The arcade theme on every Plate surface, in dark (the default) and light (<html data-theme="light">).
// Every test also fails on any console error (see support.ts), so each screen opened here is checked for that too.
import type { Locator, Page } from '@playwright/test';
import { expect, floatingToolbar, newParagraphAtEnd, openPage, richBody, seedPage, selectLeft, signIn, test, tool, toolbar } from './support.js';

/** Token values from src/theme/tokens.css, as the browser reports them. */
const THEMES = {
  dark: { raised: 'rgb(30, 40, 88)', text: 'rgb(244, 238, 223)', field: 'rgb(8, 13, 36)', band: 'rgb(18, 26, 66)', paper: 'rgb(22, 31, 75)' },
  light: { raised: 'rgb(255, 255, 255)', text: 'rgb(19, 27, 63)', field: 'rgb(255, 253, 247)', band: 'rgb(232, 224, 200)', paper: 'rgb(251, 248, 240)' },
} as const;
type Palette = (typeof THEMES)[keyof typeof THEMES];

/** Resolves a CSS variable the way the browser does. */
const resolved = (page: Page, name: string) => page.evaluate((n) => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = `var(${n})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
}, name);

async function expectSurface(target: Locator, c: Palette, what: string): Promise<void> {
  await expect(target, what).toBeVisible();
  await expect(target, what).toHaveCSS('background-color', c.raised);
  await expect(target, what).toHaveCSS('color', c.text);
}

const BODY = 'Intro paragraph with words.\n\n:::note\nA note.\n:::\n\n```bash\nnpm ci\n```\n\n| Key | Value |\n|---|---|\n| a | 1 |\n\nLast paragraph.\n';

for (const [name, c] of Object.entries(THEMES) as [keyof typeof THEMES, Palette][]) {
  test(`${name} theme: the editor, its menus, popovers and dialogs use the arcade palette`, async ({ page }) => {
    const pagePath = await seedPage(`theme-${name}`, BODY);
    await signIn(page);
    if (name === 'light') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    else await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // dark is the default
    await openPage(page, pagePath);
    await expect(richBody(page)).toContainText('A note.');

    // The palette and the shadcn variables Plate's UI reads are the arcade tokens.
    for (const [token, value] of [['--ed-raised', c.raised], ['--ed-text', c.text], ['--ed-field', c.field], ['--ed-band', c.band], ['--ed-paper', c.paper]] as const) {
      expect(await resolved(page, token), token).toBe(value);
    }
    expect(await resolved(page, '--background')).toBe(c.paper);
    expect(await resolved(page, '--popover')).toBe(c.raised);
    expect(await resolved(page, '--muted')).toBe(c.band);
    expect(await resolved(page, '--foreground')).toBe(c.text);

    // Toolbar tooltips (ui/toolbar.tsx) are drawn in the primary colour: --primary / --primary-foreground,
    // which are the arcade --ed-primary / --ed-on-primary.
    const primary = await resolved(page, '--ed-primary');
    const onPrimary = await resolved(page, '--ed-on-primary');
    expect(await resolved(page, '--primary')).toBe(primary);
    expect(await resolved(page, '--primary-foreground')).toBe(onPrimary);
    await tool(page, 'Bold (Ctrl+B)').hover();
    const tip = page.locator('[data-slot="tooltip-content"]');
    await expect(tip).toBeVisible();
    await expect(tip).toHaveCSS('background-color', primary);
    await expect(tip).toHaveCSS('color', onPrimary);
    // Move down onto the page, away from the tooltip. Radix closes a hoverable tooltip on the next pointer
    // move outside the button and the tooltip, so move in steps (one jump sends no later move).
    const body = await richBody(page).boundingBox();
    if (!body) throw new Error('page body has no box');
    await page.mouse.move(body.x + 24, body.y + 48, { steps: 8 });
    await expect(tip).toHaveCount(0);

    // Fixed surfaces: writing surface, toolbar band, frontmatter panel, table header, admonition.
    await expect(page.locator('.editorFrame')).toHaveCSS('background-color', c.paper);
    await expect(richBody(page)).toHaveCSS('color', c.text);
    await expect(toolbar(page)).toHaveCSS('background-color', c.band);
    await expect(page.locator('.frontmatter')).toHaveCSS('background-color', c.band);
    await expect(richBody(page).locator('th').first()).toHaveCSS('background-color', c.band);
    await expect(richBody(page).locator('.slate-callout')).toHaveCSS('background-color', await resolved(page, '--ed-adm-note-bg'));

    // Toolbar menus.
    await richBody(page).getByText('Intro paragraph with words.').click();
    for (const label of ['Block type', 'Table', 'Insert admonition', 'Insert component']) {
      await tool(page, label).click();
      await expectSurface(page.getByRole('menu'), c, label);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu'), label).toHaveCount(0);
    }

    // The floating toolbar and the link popover.
    await richBody(page).getByText('Intro paragraph with words.').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' More');
    await selectLeft(page, 4);
    await expectSurface(floatingToolbar(page), c, 'floating toolbar');
    await tool(page, 'Link').click();
    const linkInput = page.getByPlaceholder('Paste link');
    await expect(linkInput).toBeVisible();
    await expectSurface(linkInput.locator('xpath=ancestor::div[contains(@class, "bg-popover")][1]'), c, 'link popover');
    await page.keyboard.press('Escape');
    await expect(linkInput).toHaveCount(0);

    // The "/" menu.
    await newParagraphAtEnd(page);
    await page.keyboard.type('/');
    const slash = page.getByRole('listbox');
    await expectSurface(slash, c, 'slash menu');
    await page.keyboard.press('Escape');
    await expect(slash).toHaveCount(0);

    // The code block language picker.
    await richBody(page).getByRole('combobox').click();
    const languages = page.locator('[data-slot="popover-content"]');
    await expectSurface(languages, c, 'language picker');
    await page.keyboard.press('Escape');
    await expect(languages).toHaveCount(0);

    // Dialogs: Plate's (image by URL) and the app's (insert from repo), with inputs on the field colour.
    await tool(page, 'Insert image by URL').click();
    const imageDialog = page.getByRole('dialog', { name: 'Insert image by URL' });
    await expectSurface(imageDialog, c, 'image dialog');
    await expect(imageDialog.getByLabel('URL')).toHaveCSS('background-color', c.field);
    await page.keyboard.press('Escape');
    await expect(imageDialog).toHaveCount(0);

    await tool(page, 'Insert from repo (existing models and images)').click();
    const repoDialog = page.getByRole('dialog', { name: 'Insert from repo' });
    await expectSurface(repoDialog, c, 'insert from repo dialog');
    await repoDialog.getByRole('button', { name: 'Close' }).click();
    await expect(repoDialog).toHaveCount(0);
  });
}

/** WCAG relative luminance of an `rgb(r, g, b)` colour. */
function luminance(rgb: string): number {
  const parts = rgb.match(/\d+(\.\d+)?/g);
  if (!parts || parts.length < 3) throw new Error(`not an rgb colour: ${rgb}`);
  const [r, g, b] = parts.slice(0, 3).map((p) => {
    const v = Number(p) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const name of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
  test(`${name} theme: an unchecked to-do checkbox stands out from the page (WCAG 1.4.11, 3:1)`, async ({ page }) => {
    const pagePath = await seedPage(`checkbox-${name}`, '* [ ] Open task\n* [x] Done task\n');
    await signIn(page);
    if (name === 'light') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await openPage(page, pagePath);
    const unchecked = richBody(page).getByRole('checkbox', { checked: false });
    await expect(unchecked).toHaveCount(1);
    const border = await unchecked.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(border).toBe(await resolved(page, '--ed-text-faint'));
    const paper = await page.locator('.editorFrame').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(contrast(border, paper)).toBeGreaterThanOrEqual(3);
  });
}

test('the sign-in screen and the app dialogs follow the theme too', async ({ page }) => {
  for (const [name, c] of Object.entries(THEMES) as [keyof typeof THEMES, Palette][]) {
    await page.goto('/');
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), name);
    await expect(page.locator('body'), name).toHaveCSS('color', c.text);
    await expect(page.getByLabel('Display name'), name).toHaveCSS('background-color', c.field);
    await page.getByLabel('Display name').fill('Theme Check');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), name);
    await page.getByRole('button', { name: 'New page' }).click();
    await expectSurface(page.getByRole('dialog', { name: 'New page' }), c, `${name} new page dialog`);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Publish version' }).click();
    await expectSurface(page.getByRole('dialog', { name: 'Publish a frozen version' }), c, `${name} publish dialog`);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Forget token' }).click();
  }
});

test('the formatting toolbar sticks flush to the top of the scrolled page: no text shows above it', async ({ page }) => {
  const body = Array.from({ length: 60 }, (_, i) => `Paragraph number ${i + 1} of a long page.`).join('\n\n') + '\n';
  const pagePath = await seedPage('sticky-toolbar', body);
  await signIn(page);
  await openPage(page, pagePath);
  await expect(richBody(page)).toContainText('Paragraph number 60');
  const main = page.locator('.main');
  await main.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
  const pane = await main.boundingBox();
  const bar = await toolbar(page).boundingBox();
  if (!pane || !bar) throw new Error('no box');
  expect(Math.abs(bar.y - pane.y)).toBeLessThanOrEqual(1);
});
