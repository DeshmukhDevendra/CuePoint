import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma } from '@cuepoint/db'
import {
  CONTROLLER_TOKEN_HEADER,
  CreateAnonymousRoomSchema,
  getViewerAccess,
  PublicRoomForQuerySchema,
  SubmitQuestionBodySchema,
  S2C,
} from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { roomInclude } from '../lib/roomInclude.js'
import { sanitizeRoomWire } from '../lib/sanitizeRoom.js'

function makeApiKey() {
  return `room_${randomBytes(16).toString('hex')}`
}

export function makePublicRoomsRouter(io: SocketIOServer) {
  const router = Router()

  router.post('/', async (req, res) => {
    const parsed = CreateAnonymousRoomSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const title = parsed.data.title ?? 'Untitled Room'
    const timezone = parsed.data.timezone

    const controllerToken = randomBytes(32).toString('base64url')
    const anonymousControllerSecretHash = await hashPassword(controllerToken)

    const room = await prisma.$transaction(async (tx) => {
      const r = await tx.room.create({
        data: {
          title,
          timezone,
          ownerId: null,
          teamId: null,
          apiKey: makeApiKey(),
          anonymousControllerSecretHash,
        },
      })
    await tx.timer.create({
      data: {
        roomId: r.id,
        order: 0,
        title: 'First timer',
        durationMs: 5 * 60 * 1000,
      },
    })
    await tx.submitQuestionConfig.create({
      data: {
        roomId: r.id,
        enabled: true,
        title: 'Ask a question',
        subtitle: 'Your question may be reviewed before it appears on screen.',
        questionLabel: 'Your question',
        nameLabel: 'Your name',
      },
    })
    return tx.room.findFirstOrThrow({
        where: { id: r.id },
        include: roomInclude,
      })
    })

    const safe = sanitizeRoomWire(room)
    return res.status(201).json({
      room: { ...safe, writeAccess: true },
      controllerToken,
    })
  })

  /** Audience questions — no auth; optional SubmitQuestionConfig gate */
  router.post('/:roomId/submit-question', async (req, res) => {
    const roomId = req.params['roomId']
    const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } })
    if (!room) return res.status(404).json({ error: 'not_found' })

    const cfg = await prisma.submitQuestionConfig.findUnique({ where: { roomId: room.id } })
    if (cfg && !cfg.enabled) {
      return res.status(403).json({
        error: 'submissions_closed',
        message: cfg.closedMessage ?? 'Submissions are closed.',
      })
    }

    const parsed = SubmitQuestionBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const maxOrder = await prisma.message.aggregate({
      where: { roomId: room.id },
      _max: { order: true },
    })
    const order = (maxOrder._max.order ?? -1) + 1

    const message = await prisma.message.create({
      data: {
        roomId: room.id,
        text: parsed.data.text,
        color: 'white',
        bold: false,
        uppercase: false,
        flash: false,
        focus: false,
        visible: false,
        order,
        source: 'AUDIENCE',
        authorName: parsed.data.name ?? null,
      },
    })

    io.to(`room:${room.id}`).emit(S2C.MESSAGE_LIST_UPDATED, { type: 'created', message })
    return res.status(201).json({ ok: true, id: message.id })
  })

  /** Public copy for the audience submit form (no secrets). */
  router.get('/:roomId/submit-config', async (req, res) => {
    const roomId = req.params['roomId']
    const room = await prisma.room.findFirst({ where: { id: roomId, deletedAt: null } })
    if (!room) return res.status(404).json({ error: 'not_found' })

    const cfg = await prisma.submitQuestionConfig.findUnique({ where: { roomId: room.id } })
    return res.json({
      enabled: cfg?.enabled ?? true,
      closedMessage: cfg?.closedMessage ?? null,
      logoUrl: cfg?.logoUrl ?? null,
      title: cfg?.title ?? 'Ask a question',
      subtitle:
        cfg?.subtitle ?? 'Your question may be reviewed before it appears on screen.',
      questionLabel: cfg?.questionLabel ?? 'Your question',
      nameLabel: cfg?.nameLabel ?? 'Your name',
      hideName: cfg?.hideName ?? false,
    })
  })

  router.get('/:roomId', async (req, res) => {
    const roomId = req.params['roomId']
    const tokenRaw = req.get(CONTROLLER_TOKEN_HEADER)
    const controllerToken = typeof tokenRaw === 'string' && tokenRaw.length > 0 ? tokenRaw : undefined

    const room = await prisma.room.findFirst({
      where: { id: roomId, deletedAt: null },
      include: roomInclude,
    })
    if (!room) return res.status(404).json({ error: 'not_found' })

    const forRaw = req.query['for']
    const forParsed =
      typeof forRaw === 'string' ? PublicRoomForQuerySchema.safeParse(forRaw) : null
    const forParam = forParsed?.success ? forParsed.data : undefined
    if (forParam === 'viewer' && getViewerAccess(room.settings) === 'output_link_only') {
      return res.status(403).json({ error: 'viewer_requires_output_link' })
    }

    let writeAccess = false
    if (!room.ownerId && room.anonymousControllerSecretHash && controllerToken) {
      try {
        writeAccess = await verifyPassword(room.anonymousControllerSecretHash, controllerToken)
      } catch {
        writeAccess = false
      }
    }

    const safe = sanitizeRoomWire(room)
    return res.json({ ...safe, writeAccess })
  })

  return router
}
