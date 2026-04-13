import { config } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// Load .env from this app, or fall back to the monorepo root.
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(import.meta.dirname, '../../.env'),
  resolve(import.meta.dirname, '../../../.env'),
]
for (const p of candidates) {
  if (existsSync(p)) { config({ path: p }); break }
}
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default('cuepoint_session'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().optional().default('invites@cuepoint.app'),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
