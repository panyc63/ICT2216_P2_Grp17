import { defineConfig, devices } from '@playwright/test'

// The full stack (database + backend + built SPA served on a same-origin /api proxy) is
// booted by ../scripts/e2e-up.sh; these tests only drive the already-running site. Point
// E2E_BASE_URL at any running instance (local preview by default, or a staging URL).
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4180'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Fake camera/mic so the video-consultation smoke can call getUserMedia headlessly.
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
