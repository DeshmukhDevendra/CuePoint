/**
 * Windows: Prisma often hits EPERM when replacing query_engine*.dll if any process
 * still loads it (pnpm dev, API, IDE TS server). We try to remove the output dir
 * first; on EPERM we warn and continue — `prisma generate` may still succeed.
 *
 * Skip entirely: PRISMA_SKIP_PREPARE=1
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'generated', 'prisma')
const legacyOutDir = path.join(root, 'src', 'generated', 'prisma')

if (process.env.PRISMA_SKIP_PREPARE === '1') {
  console.log('[prisma-prepare-generate] Skipped (PRISMA_SKIP_PREPARE=1).')
  process.exit(0)
}

function isLockError(err) {
  const c = err && typeof err === 'object' && 'code' in err ? err.code : ''
  return c === 'EPERM' || c === 'EBUSY' || c === 'ENOTEMPTY' || c === 'EACCES'
}

function rmDirBestEffort(dir) {
  if (!fs.existsSync(dir)) return { ok: true }
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 })
    return { ok: true }
  } catch (err) {
    return { ok: false, err }
  }
}

for (const dir of [legacyOutDir, outDir]) {
  const { ok, err } = rmDirBestEffort(dir)
  if (!ok) {
    if (isLockError(err)) {
      console.warn(`[prisma-prepare-generate] Could not remove (file in use): ${dir}`)
      console.warn('  Stop: pnpm dev / API / web, then run pnpm db:generate again.')
      console.warn('  Or use: pnpm db:generate:noclean   (skips this cleanup step)\n')
    } else {
      console.error('[prisma-prepare-generate] Could not remove', dir, '\n', err)
      process.exit(1)
    }
  }
}
