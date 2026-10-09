// The LIVE end-to-end test: the site is built and served from this checkout, but the editor talks to the REAL
// GitHub with the token in GITHUB_TOKEN. Every step is a real commit to main (and starts a Pages deploy).
// Run by a person, never by an agent or in CI:  $env:GITHUB_TOKEN = "<token>";  npm run e2e:live -w @platform/site
//
// The token is read from the environment only. It is never written to a file, printed or logged: traces,
// videos and screenshots are off (a trace would record what is typed and every request header).
import { defineConfig, devices } from '@playwright/test';

if (!process.env.GITHUB_TOKEN?.trim()) {
  console.error('e2e:live needs GITHUB_TOKEN in your terminal (not in a file). See site/e2e/live/require-token.mjs.');
  process.exit(1);
}

// On a failure Playwright writes test-results/**/error-context.md with an aria snapshot of the page, and that snapshot
// lists the value of every text box: a failure while the sign-in dialog is open would write the token to disk.
// This turns the page snapshot off (set here, so the test workers inherit it).
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

const PORT = 3212;
// One page name per run (the config is loaded before the workers start, so they inherit it).
process.env.E2E_LIVE_PAGE ??= `e2e-live-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;

export default defineConfig({
  testDir: './e2e/live',
  globalTeardown: './e2e/live/global-teardown.ts',
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/documentation-system/`,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `node e2e/live/prepare.mjs && npm run build && npx docusaurus serve --port ${PORT} --host 127.0.0.1 --no-open`,
    env: { PLATFORM_BUILD_SHA: 'e2e-live-1', E2E_LIVE_PAGE: process.env.E2E_LIVE_PAGE },
    url: `http://127.0.0.1:${PORT}/documentation-system/`,
    timeout: 600_000,
    reuseExistingServer: false,
  },
});
