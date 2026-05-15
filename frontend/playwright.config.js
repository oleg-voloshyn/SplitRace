import { defineConfig, devices } from '@playwright/test';

const port = process.env.E2E_PORT || '4010';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `cd .. && PATH="$HOME/.rbenv/shims:$PATH" RAILS_ENV=test bin/rails db:test:prepare && PATH="$HOME/.rbenv/shims:$PATH" RAILS_ENV=test bin/rails server -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
