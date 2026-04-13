import { Router, type Request } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma, type Prisma } from '@cuepoint/db'
import {
  CreateOutputLinkSchema,
  CreateOutputSchema,
  ImportOutputLayoutBodySchema,
  ImportOutputLayoutRemoteBodySchema,
  UpdateOutputBodySchema,
  defaultCustomOutputLayout,
} from '@cuepoint/shared'
import { hashPassword } from '../auth/password.js'
import { assertRoomControl } from '../auth/roomControl.js'
import { randomShortCode } from '../lib/shortCode.js'

type RoomParams = { roomId?: string }

export function makeOutputsRouter() {
  const router = Router({ mergeParams: true })

  function rid(req: Request): string | undefined {
    return (req.params as RoomParams).roomId
  }

  router.get('/', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const outputs = await prisma.output.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
      include: {
        links: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    const mapped = outputs.map((o) => {
      const { passwordHash, ...rest } = o
      return { ...rest, hasPassword: Boolean(passwordHash) }
    })
    return res.json(mapped)
  })

  router.post('/', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const parsed = CreateOutputSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const isCustom = parsed.data.type === 'CUSTOM'
    const output = await prisma.output.create({
      data: {
        roomId: room.id,
        name: parsed.data.name,
        type: parsed.data.type,
        ...(isCustom
          ? { layout: defaultCustomOutputLayout() as unknown as Prisma.InputJsonValue }
          : {}),
      },
    })
    return res.status(201).json({ ...output, hasPassword: false })
  })

  router.get('/:outputId', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const outputId = (req.params as { outputId?: string }).outputId
    if (!outputId) return res.status(400).json({ error: 'invalid_input' })

    const row = await prisma.output.findFirst({
      where: { id: outputId, roomId: room.id },
    })
    if (!row) return res.status(404).json({ error: 'not_found' })
    const { passwordHash, ...rest } = row
    return res.json({ ...rest, hasPassword: Boolean(passwordHash) })
  })

  /** Copy layout JSON from another output in the same room (controller). */
  router.post('/:outputId/import-layout', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const outputId = (req.params as { outputId?: string }).outputId
    if (!outputId) return res.status(400).json({ error: 'invalid_input' })

    const target = await prisma.output.findFirst({
      where: { id: outputId, roomId: room.id },
    })
    if (!target) return res.status(404).json({ error: 'not_found' })

    const parsed = ImportOutputLayoutBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const source = await prisma.output.findFirst({
      where: { id: parsed.data.fromOutputId, roomId: room.id },
    })
    if (!source) return res.status(404).json({ error: 'not_found' })

    const updated = await prisma.output.update({
      where: { id: target.id },
      data: { layout: source.layout as Prisma.InputJsonValue },
    })
    const { passwordHash: _passwordHash, ...rest } = updated
    return res.json({ ...rest, hasPassword: Boolean(updated.passwordHash) })
  })

  /**
   * Copy layout JSON from an output in another room, when the signed-in user owns both rooms.
   * Guest controller tokens cannot use this route.
   */
  router.post('/:outputId/import-layout-remote', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })
    if (room.ownerId !== req.user.id) return res.status(403).json({ error: 'forbidden' })

    const outputId = (req.params as { outputId?: string }).outputId
    if (!outputId) return res.status(400).json({ error: 'invalid_input' })

    const parsed = ImportOutputLayoutRemoteBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const target = await prisma.output.findFirst({
      where: { id: outputId, roomId: room.id },
    })
    if (!target) return res.status(404).json({ error: 'not_found' })

    const sourceRoom = await prisma.room.findFirst({
      where: { id: parsed.data.sourceRoomId, deletedAt: null, ownerId: req.user.id },
    })
    if (!sourceRoom) return res.status(404).json({ error: 'not_found' })

    const source = await prisma.output.findFirst({
      where: { id: parsed.data.sourceOutputId, roomId: sourceRoom.id },
    })
    if (!source) return res.status(404).json({ error: 'not_found' })

    const updated = await prisma.output.update({
      where: { id: target.id },
      data: { layout: source.layout as Prisma.InputJsonValue },
    })
    const { passwordHash: _pw, ...rest } = updated
    return res.json({ ...rest, hasPassword: Boolean(updated.passwordHash) })
  })

  router.post('/:outputId/links', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const outputId = (req.params as { outputId?: string }).outputId
    if (!outputId) return res.status(400).json({ error: 'invalid_input' })

    const output = await prisma.output.findFirst({
      where: { id: outputId, roomId: room.id },
    })
    if (!output) return res.status(404).json({ error: 'not_found' })

    const parsed = CreateOutputLinkSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const options = parsed.data.options ?? {}
    const signature = randomBytes(24).toString('base64url')

    let shortCode: string | null = null
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = randomShortCode(8)
      const taken = await prisma.outputLink.findUnique({ where: { shortCode: candidate } })
      if (!taken) {
        shortCode = candidate
        break
      }
    }

    const link = await prisma.outputLink.create({
      data: {
        outputId: output.id,
        signature,
        shortCode,
        options,
      },
    })

    const base = `/out/${encodeURIComponent(link.signature)}`
    const shortPath = link.shortCode ? `/o/${encodeURIComponent(link.shortCode)}` : null
    const qrUrl = `/api/public/output-links/qr?signature=${encodeURIComponent(link.signature)}`
    const qrShortUrl = link.shortCode
      ? `/api/public/output-links/qr?short=${encodeURIComponent(link.shortCode)}`
      : null

    return res.status(201).json({
      ...link,
      path: base,
      shortPath,
      qrUrl,
      qrShortUrl,
    })
  })

  router.patch('/:outputId', async (req, res) => {
    const roomId = rid(req)
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const outputId = (req.params as { outputId?: string }).outputId
    if (!outputId) return res.status(400).json({ error: 'invalid_input' })

    const output = await prisma.output.findFirst({
      where: { id: outputId, roomId: room.id },
    })
    if (!output) return res.status(404).json({ error: 'not_found' })

    const parsed = UpdateOutputBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const data: Prisma.OutputUpdateInput = {}
    if (parsed.data.password !== undefined) {
      data.passwordHash =
        parsed.data.password === null ? null : await hashPassword(parsed.data.password)
    }
    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name
    }
    if (parsed.data.layout !== undefined) {
      data.layout = parsed.data.layout as Prisma.InputJsonValue
    }
    if (parsed.data.logoUrl !== undefined) {
      data.logoUrl = parsed.data.logoUrl === '' || parsed.data.logoUrl === null ? null : parsed.data.logoUrl
    }
    if (parsed.data.logoMode !== undefined) {
      data.logoMode = parsed.data.logoMode
    }

    if (Object.keys(data).length === 0) {
      const { passwordHash, ...rest } = output
      return res.json({ ...rest, hasPassword: Boolean(passwordHash) })
    }

    const updated = await prisma.output.update({
      where: { id: output.id },
      data,
    })
    const { passwordHash: _h, ...rest } = updated
    return res.json({ ...rest, hasPassword: Boolean(updated.passwordHash) })
  })

  return router
}
