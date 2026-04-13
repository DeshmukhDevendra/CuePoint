import { createHmac, timingSafeEqual } from 'node:crypto'
import { parse as parseCookie } from 'cookie'

export const OUTPUT_LINK_UNLOCK_COOKIE = 'cuepoint_output_link_unlock'

const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createOutputLinkUnlockToken(signature: string, secret: string): string {
  const exp = Date.now() + TTL_MS
  const payload = JSON.stringify({ signature, exp })
  const b64 = Buffer.from(payload, 'utf8').toString('base64url')
  const mac = createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${mac}`
}

/** Returns unlocked link signature, or null if missing/invalid/expired. */
export function readOutputLinkUnlockToken(cookieHeader: string | undefined, secret: string): string | null {
  if (!cookieHeader) return null
  const cookies = parseCookie(cookieHeader)
  const raw = cookies[OUTPUT_LINK_UNLOCK_COOKIE]
  if (!raw || !raw.includes('.')) return null
  const dot = raw.lastIndexOf('.')
  const b64 = raw.slice(0, dot)
  const mac = raw.slice(dot + 1)
  const expectedMac = createHmac('sha256', secret).update(b64).digest('base64url')
  try {
    if (mac.length !== expectedMac.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) {
      return null
    }
  } catch {
    return null
  }
  let payload: { signature?: string; exp?: number }
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as { signature?: string; exp?: number }
  } catch {
    return null
  }
  if (typeof payload.signature !== 'string' || typeof payload.exp !== 'number') return null
  if (payload.exp < Date.now()) return null
  return payload.signature
}

export function unlockCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: Math.floor(TTL_MS / 1000),
  }
}
