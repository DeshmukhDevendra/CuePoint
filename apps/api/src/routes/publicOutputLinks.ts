import { Router, type Request } from 'express'
import QRCode from 'qrcode'
import { serialize } from 'cookie'
import { prisma } from '@cuepoint/db'
import { UnlockOutputLinkBodySchema, parseOutputLayoutOrDefault } from '@cuepoint/shared'
import { verifyPassword } from '../auth/password.js'
import { env } from '../env.js'
import { roomInclude } from '../lib/roomInclude.js'
import {
  createOutputLinkUnlockToken,
  OUTPUT_LINK_UNLOCK_COOKIE,
  readOutputLinkUnlockToken,
  unlockCookieOptions,
} from '../lib/outputLinkUnlock.js'
import { sanitizeRoomWire } from '../lib/sanitizeRoom.js'

const LOCKED_QR_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
    <rect fill="#222" width="120" height="120" rx="8"/>
    <text x="60" y="64" text-anchor="middle" fill="#888" font-size="11" font-family="system-ui">Locked</text>
  </svg>`,
  'utf8'
)

type LinkRow = {
  signature: string
  shortCode: string | null
  expiresAt: Date | null
  options: unknown
  output: {
    id: string
    roomId: string
    passwordHash: string | null
    name: string
    type: string
    layout: unknown
    logoUrl: string | null
    logoMode: string
  }
}

function isLinkUnlocked(req: Request, linkSignature: string): boolean {
  const unlocked = readOutputLinkUnlockToken(req.headers.cookie, env.AUTH_SECRET)
  return unlocked === linkSignature
}

async function resolveLinkPayload(link: LinkRow) {
  if (link.expiresAt && link.expiresAt < new Date()) {
    return { error: 'link_expired' as const }
  }

  const room = await prisma.room.findFirst({
    where: { id: link.output.roomId, deletedAt: null },
    include: roomInclude,
  })
  if (!room) return { error: 'not_found' as const }

  const safe = sanitizeRoomWire(room)
  const options = typeof link.options === 'object' && link.options !== null ? link.options : {}
  const out = link.output
  const wireLayout = out.type === 'CUSTOM' ? parseOutputLayoutOrDefault(out.layout) : out.layout
  return {
    room: safe,
    options,
    joinSignature: link.signature,
    shortCode: link.shortCode,
    output: {
      id: out.id,
      name: out.name,
      type: out.type,
      layout: wireLayout,
      logoUrl: out.logoUrl,
      logoMode: out.logoMode,
    },
  }
}

export function makePublicOutputLinksRouter() {
  const router = Router()

  router.post('/unlock', async (req, res) => {
    const parsed = UnlockOutputLinkBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const { signature, shortCode, password } = parsed.data
    const where = signature ? { signature } : { shortCode: shortCode as string }
    const link = await prisma.outputLink.findFirst({
      where,
      include: { output: true },
    })
    if (!link) return res.status(404).json({ error: 'not_found' })
    if (!link.output.passwordHash) {
      return res.status(400).json({ error: 'no_output_password' })
    }

    let ok = false
    try {
      ok = await verifyPassword(link.output.passwordHash, password)
    } catch {
      ok = false
    }
    if (!ok) return res.status(403).json({ error: 'invalid_password' })

    const token = createOutputLinkUnlockToken(link.signature, env.AUTH_SECRET)
    res.setHeader('Set-Cookie', serialize(OUTPUT_LINK_UNLOCK_COOKIE, token, unlockCookieOptions()))
    return res.json({ ok: true })
  })

  router.get('/qr', async (req, res) => {
    const signature = typeof req.query['signature'] === 'string' ? req.query['signature'] : ''
    const short = typeof req.query['short'] === 'string' ? req.query['short'] : ''
    let link: LinkRow | null = null
    if (short) {
      const row = await prisma.outputLink.findFirst({
        where: { shortCode: short },
        include: { output: true },
      })
      if (row && (!row.expiresAt || row.expiresAt >= new Date())) link = row as LinkRow
    } else if (signature) {
      const row = await prisma.outputLink.findFirst({
        where: { signature },
        include: { output: true },
      })
      if (row && (!row.expiresAt || row.expiresAt >= new Date())) link = row as LinkRow
    } else {
      return res.status(400).json({ error: 'invalid_input' })
    }

    if (!link) return res.status(404).end()

    if (link.output.passwordHash && !isLinkUnlocked(req, link.signature)) {
      res.setHeader('content-type', 'image/svg+xml')
      res.setHeader('cache-control', 'no-store')
      return res.status(200).send(LOCKED_QR_SVG)
    }

    const targetUrl = short
      ? `${env.WEB_BASE_URL.replace(/\/$/, '')}/o/${encodeURIComponent(short)}`
      : `${env.WEB_BASE_URL.replace(/\/$/, '')}/out/${encodeURIComponent(signature)}`

    try {
      const png = await QRCode.toBuffer(targetUrl, { type: 'png', margin: 1, width: 280 })
      res.setHeader('content-type', 'image/png')
      res.setHeader('cache-control', 'public, max-age=300')
      return res.send(png)
    } catch {
      return res.status(500).json({ error: 'internal_error' })
    }
  })

  router.get('/short/:shortCode', async (req, res) => {
    const shortCode = (req.params as { shortCode?: string }).shortCode
    if (!shortCode) return res.status(400).json({ error: 'invalid_input' })

    const link = await prisma.outputLink.findFirst({
      where: { shortCode },
      include: { output: true },
    })
    if (!link) return res.status(404).json({ error: 'not_found' })

    const row = link as LinkRow
    if (row.output.passwordHash && !isLinkUnlocked(req, row.signature)) {
      return res.status(401).json({ error: 'output_password_required' })
    }

    const payload = await resolveLinkPayload(row)
    if ('error' in payload) {
      return res.status(payload.error === 'link_expired' ? 410 : 404).json({ error: payload.error })
    }
    return res.json(payload)
  })

  router.get('/:signature', async (req, res) => {
    const signature = (req.params as { signature?: string }).signature
    if (!signature) return res.status(400).json({ error: 'invalid_input' })

    const link = await prisma.outputLink.findFirst({
      where: { signature },
      include: { output: true },
    })
    if (!link) return res.status(404).json({ error: 'not_found' })

    const row = link as LinkRow
    if (row.output.passwordHash && !isLinkUnlocked(req, row.signature)) {
      return res.status(401).json({ error: 'output_password_required' })
    }

    const payload = await resolveLinkPayload(row)
    if ('error' in payload) {
      return res.status(payload.error === 'link_expired' ? 410 : 404).json({ error: payload.error })
    }
    return res.json(payload)
  })

  return router
}
