// The live e2e config handles a real token: nothing Playwright writes to disk may contain it. This loads the config
// with a placeholder value (never a real token) and checks the settings that keep the token off disk.
import { afterAll, describe, expect, it } from 'vitest';

const saved = { token: process.env.GITHUB_TOKEN, page: process.env.E2E_LIVE_PAGE, noCopy: process.env.PLAYWRIGHT_NO_COPY_PROMPT };
afterAll(() => {
  for (const [key, value] of [['GITHUB_TOKEN', saved.token], ['E2E_LIVE_PAGE', saved.page], ['PLAYWRIGHT_NO_COPY_PROMPT', saved.noCopy]] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('playwright.live.config.ts', () => {
  it('records no trace, video or screenshot, and no page snapshot in error-context.md (it holds input values)', async () => {
    process.env.GITHUB_TOKEN = 'placeholder-not-a-token';
    delete process.env.PLAYWRIGHT_NO_COPY_PROMPT;
    const config = (await import('../playwright.live.config.ts')).default;
    expect(config.use).toMatchObject({ trace: 'off', video: 'off', screenshot: 'off' });
    // On a failure Playwright writes test-results/**/error-context.md with an aria snapshot of the page, which lists
    // the value of every text box, the token field of the sign-in dialog included. This variable turns it off.
    expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe('1');
  });
});
