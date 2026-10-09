// The editor uses the site's palette in both colour modes, and never restyles the site around it.
import type { Page } from '@playwright/test';
import { test, expect, openEditor, button } from './support';

const PROPS = ['color', 'background-color', 'font-family', 'font-size', 'padding-top', 'padding-left', 'margin-top', 'height', 'border-bottom-color', 'box-sizing'];

/** Computed styles of the site chrome (navbar, its links, the sidebar menu, the TOC, body). */
async function chromeStyles(page: Page): Promise<Record<string, string>> {
  return page.evaluate((props) => {
    const out: Record<string, string> = {};
    const pick: [string, string][] = [['navbar', '.navbar'], ['navlink', '.navbar__link'], ['brand', '.navbar__title'], ['menu', '.theme-doc-sidebar-menu .menu__link'], ['toc', '.table-of-contents__link'], ['body', 'body'], ['footer', '.footer']];
    for (const [name, sel] of pick) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      for (const p of props) out[`${name}.${p}`] = cs.getPropertyValue(p);
    }
    return out;
  }, PROPS);
}

const rgb = (page: Page, cssVar: string) => page.evaluate((v) => {
  const probe = document.createElement('div');
  probe.style.color = `var(${v})`;
  document.body.append(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}, cssVar);

for (const mode of ['dark', 'light'] as const) {
  test(`${mode} mode: the editor follows the site palette and leaves the site chrome untouched`, async ({ page, gh: _gh }) => {
    await page.addInitScript((m) => { try { localStorage.setItem('theme', m); } catch { /* ignore */ } }, mode);
    await page.goto('systems/inventory');
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await page.waitForLoadState('networkidle');
    const before = await chromeStyles(page);

    await openEditor(page, 'systems/inventory');
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    expect(await chromeStyles(page)).toEqual(before);

    // Save is the site's primary colour; the edit bar sits on the site's surface colour.
    const save = button(page, 'Save');
    expect(await save.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await rgb(page, '--ifm-color-primary'));
    const bar = page.getByRole('toolbar', { name: 'Edit page' });
    expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await rgb(page, '--ifm-background-surface-color'));
    // The page content keeps the page's heading sizes.
    const h2 = page.locator('[data-slate-editor] h2').first();
    expect(await h2.evaluate((el) => getComputedStyle(el).fontSize)).toBe('32px');

    // Menus and dialogs too.
    await button(page, 'Page actions').click();
    const menu = page.getByRole('menu', { name: 'Page actions' });
    expect(await menu.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await rgb(page, '--ifm-background-surface-color'));
    await page.keyboard.press('Escape');

    await button(page, 'Cancel').click();
    await expect(page.locator('[data-platform-editing]')).toHaveCount(0);
    expect(await chromeStyles(page)).toEqual(before);
  });
}

test('the formatting toolbar sticks below the navbar and the edit bar while scrolling', async ({ page, gh: _gh }) => {
  await openEditor(page, 'platform/architecture');
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(300);
  const navbar = await page.locator('.navbar').boundingBox();
  const bar = await page.getByRole('toolbar', { name: 'Edit page' }).boundingBox();
  const toolbar = await page.getByRole('toolbar', { name: 'Formatting' }).boundingBox();
  expect(navbar && bar && toolbar).toBeTruthy();
  expect(Math.abs(bar!.y - (navbar!.y + navbar!.height))).toBeLessThan(2);
  expect(toolbar!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);
  expect(toolbar!.y).toBeLessThan(bar!.y + bar!.height + 12);
});
