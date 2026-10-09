import { test, expect, editButton, button, signInWithToken, body } from './support';

test.describe('Edit entry points', () => {
  test('Edit shows on Latest pages and folder intros, not on frozen versions or generated pages', async ({ page, gh: _gh }) => {
    await page.goto('systems/inventory');
    await expect(editButton(page)).toBeVisible();
    await page.goto('systems/');
    await expect(editButton(page)).toBeVisible();

    await page.goto('1.0.0/systems/');
    await expect(page.locator('article h1').first()).toBeVisible();
    await expect(editButton(page)).toHaveCount(0);
    await expect(page.locator('.theme-edit-this-page')).toHaveCount(0);

    await page.goto('log');
    await expect(page.locator('article h1').first()).toBeVisible();
    await expect(editButton(page)).toHaveCount(0);
  });

  test('the footer "Edit this page" opens the same in-place editor', async ({ page, gh: _gh }) => {
    await page.goto('getting-started');
    const footer = page.locator('.theme-edit-this-page');
    await expect(footer).toHaveText(/Edit this page/);
    await footer.click();
    await expect(page.getByRole('dialog', { name: 'Sign in to edit' })).toBeVisible();
  });

  test('readers download no editor code or styles until Edit; Cancel removes the styles again', async ({ page, gh: _gh }) => {
    const bodies: { url: string; text: string }[] = [];
    page.on('response', async (r) => {
      const url = r.url();
      if (/\.(js|css)(\?|$)/.test(url) && url.startsWith('http://127.0.0.1')) bodies.push({ url, text: await r.text().catch(() => '') });
    });
    const chunkRequests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('inplace-editor')) chunkRequests.push(r.url()); });

    await page.goto('systems/inventory');
    await expect(editButton(page)).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(b.text, b.url).not.toContain('data-slate-node');
      expect(b.text, b.url).not.toContain('data-slot="toolbar"');
      expect(b.text, b.url).not.toContain('--tw-');
    }
    expect(chunkRequests).toEqual([]);
    await expect(page.locator('style[data-platform-editor]')).toHaveCount(0);
    const before = bodies.length;

    await editButton(page).click();
    await expect(page.getByRole('dialog', { name: 'Sign in to edit' })).toBeVisible();
    expect(chunkRequests.length).toBeGreaterThan(0);
    await expect(page.locator('style[data-platform-editor]')).toHaveCount(1);
    expect(bodies.slice(before).some((b) => b.text.includes('data-slate-node'))).toBe(true);

    await signInWithToken(page);
    await expect(body(page)).toBeVisible();
    await button(page, 'Cancel').click();
    await expect(page.locator('[data-platform-editing]')).toHaveCount(0);
    await expect(page.locator('style[data-platform-editor]')).toHaveCount(0);
    await expect(page.locator('article .markdown h1').first()).toHaveText('Inventory');
  });
});
