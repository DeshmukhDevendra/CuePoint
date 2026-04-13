import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '../../.env') })

process.env.NODE_ENV ??= 'test'
process.env.AUTH_SECRET ??= 'test_auth_secret_minimum_16'
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
}
process.env.CORS_ORIGIN ??= 'http://localhost:5173'
process.env.WEB_BASE_URL ??= 'http://localhost:5173'
process.env.SESSION_COOKIE_NAME ??= 'cuepoint_session_test'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    poolOptions: {
      threads: { singleThread: true },
    },
  },
})
