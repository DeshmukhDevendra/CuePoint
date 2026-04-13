import { Router, type Request, type Response } from 'express'
import { prisma } from '@cuepoint/db'
import {
  CreateMessageSchema,
  UpdateMessageSchema,
  ReorderMessagesSchema,
  S2C,
} from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { assertRoomControl } from '../auth/roomControl.js'
type RoomParams = { roomId?: string }

export function makeMessagesRouter(io: SocketIOServer) {
  const router = Router({ mergeParams: true })

  function roomIdFrom(req: Request): string | undefined {
    return (req.params as RoomParams).roomId
  }

  async function requireControl(req: Request, res: Response, roomId: string): Promise<{ id: string } | null> {
    const room = await assertRoomControl(req, roomId)
    if (!room) {
      res.status(404).json({ error: 'not_found' })
      return null
    }
    return room
  }

  function broadcast(roomId: string, event: string, payload: unknown) {
    io.to(`room:${roomId}`).emit(event, payload)
  }

  router.get('/', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const messages = await prisma.message.findMany({
      where: { roomId: room.id },
      orderBy: { order: 'asc' },
    })
    return res.json(messages)
  })

  router.post('/', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = CreateMessageSchema.omit({ roomId: true }).safeParse(req.body)
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
        color: parsed.data.color,
        bold: parsed.data.bold,
        uppercase: parsed.data.uppercase,
        flash: parsed.data.flash,
        order,
        source: 'MANUAL',
      },
    })

    broadcast(room.id, S2C.MESSAGE_LIST_UPDATED, { type: 'created', message })
    return res.status(201).json(message)
  })

  router.patch('/:messageId', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = UpdateMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const message = await prisma.message.findFirst({
      where: { id: req.params['messageId'], roomId: room.id },
    })
    if (!message) return res.status(404).json({ error: 'not_found' })

    const updated = await prisma.message.update({ where: { id: message.id }, data: parsed.data })
    broadcast(room.id, S2C.MESSAGE_UPDATED, updated)
    return res.json(updated)
  })

  router.delete('/:messageId', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const message = await prisma.message.findFirst({
      where: { id: req.params['messageId'], roomId: room.id },
    })
    if (!message) return res.status(404).json({ error: 'not_found' })

    await prisma.message.delete({ where: { id: message.id } })
    broadcast(room.id, S2C.MESSAGE_LIST_UPDATED, { type: 'deleted', messageId: message.id })
    return res.status(204).end()
  })

  router.put('/reorder', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = ReorderMessagesSchema.safeParse({ ...req.body, roomId: room.id })
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input' })
    }

    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        prisma.message.updateMany({ where: { id, roomId: room.id }, data: { order: index } })
      )
    )

    const messages = await prisma.message.findMany({
      where: { roomId: room.id },
      orderBy: { order: 'asc' },
    })
    broadcast(room.id, S2C.MESSAGE_LIST_UPDATED, { type: 'reordered', messages })
    return res.json(messages)
  })

  return router
}
