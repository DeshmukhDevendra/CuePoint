import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === '1'

/**
 * By default Playwright starts API + Vite so `pnpm test:e2e` is self-contained.
 * - Reuse already-running servers locally: `reuseExistingServer` when not CI.
 * - Opt out (you start dev yourself): `E2E_SKIP_WEBSERVER=1 pnpm test:e2e`
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'pnpm --filter @cuepoint/api exec tsx src/index.ts',
          cwd: repoRoot,
          url: 'http://127.0.0.1:4000/health',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: 'pnpm --filter @cuepoint/web exec vite --port 5173 --host 127.0.0.1 --strictPort',
          cwd: repoRoot,
          url: 'http://127.0.0.1:5173/',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
})
