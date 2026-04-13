import { Router } from 'express'
import { prisma, Prisma } from '@cuepoint/db'
import { UpdateSubmitQuestionConfigSchema, S2C } from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { assertRoomControl } from '../auth/roomControl.js'

function defaultSubmitConfigCreate(roomId: string): Prisma.SubmitQuestionConfigUncheckedCreateInput {
  return {
    roomId,
    enabled: true,
    closedMessage: null,
    logoUrl: null,
    title: 'Ask a question',
    subtitle: 'Your question may be reviewed before it appears on screen.',
    questionLabel: 'Your question',
    nameLabel: 'Your name',
    hideName: false,
  }
}

export function makeSubmitConfigRouter(io: SocketIOServer) {
  const router = Router({ mergeParams: true })

  router.patch('/', async (req, res) => {
    const roomId = (req.params as { roomId?: string }).roomId
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })

    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const parsed = UpdateSubmitQuestionConfigSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const raw = parsed.data
    const update: Prisma.SubmitQuestionConfigUpdateInput = {}
    if (raw.enabled !== undefined) update.enabled = raw.enabled
    if (raw.closedMessage !== undefined) update.closedMessage = raw.closedMessage
    if (raw.logoUrl !== undefined) update.logoUrl = raw.logoUrl === '' ? null : raw.logoUrl
    if (raw.title !== undefined) update.title = raw.title
    if (raw.subtitle !== undefined) update.subtitle = raw.subtitle
    if (raw.questionLabel !== undefined) update.questionLabel = raw.questionLabel
    if (raw.nameLabel !== undefined) update.nameLabel = raw.nameLabel
    if (raw.hideName !== undefined) update.hideName = raw.hideName

    if (Object.keys(update).length === 0) {
      const current = await prisma.submitQuestionConfig.findUnique({ where: { roomId: room.id } })
      if (!current) return res.status(404).json({ error: 'not_found' })
      return res.json(current)
    }

    const existing = await prisma.submitQuestionConfig.findUnique({ where: { roomId: room.id } })
    if (!existing) {
      await prisma.submitQuestionConfig.create({ data: defaultSubmitConfigCreate(room.id) })
    }

    const updated = await prisma.submitQuestionConfig.update({
      where: { roomId: room.id },
      data: update,
    })

    io.to(`room:${room.id}`).emit(S2C.SUBMIT_CONFIG_UPDATED, { submitConfig: updated })
    return res.json(updated)
  })

  return router
}
