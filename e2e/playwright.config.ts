import { defineConfig, devices } from '@playwright/test'

const API_PORT = 4100
const WEB_PORT = 5174

export default defineConfig({
  testDir: '.',
  testMatch: 'daystack.spec.ts',
  // All tests share one throwaway SQLite DB and reset it in beforeEach, so run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    viewport: { width: 1280, height: 900 },
    // Evidence: a screenshot + trace for every test, video only when a test fails.
    screenshot: 'on',
    trace: 'on',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: [
    {
      command: 'node start-api.mjs',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Vite dev server proxying /api to the e2e API, never to the real one on 4000.
      command: `npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      cwd: '../client',
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
