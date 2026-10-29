import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const portalUrl = process.env.BENEFITS_PORTAL_URL?.trim();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 4 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { detail: true, suiteTitle: false }],
  ],
  use: {
    baseURL: portalUrl || 'http://127.0.0.1:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: portalUrl
    ? undefined
    : {
        command: 'npm run mock:portal',
        url: 'http://127.0.0.1:3000/login',
        reuseExistingServer: !isCI,
        timeout: 15_000,
      },
});
