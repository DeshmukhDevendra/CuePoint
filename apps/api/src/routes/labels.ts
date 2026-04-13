import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '@cuepoint/db'
import { assertRoomControl } from '../auth/roomControl.js'
import type { Server as SocketIOServer } from 'socket.io'
import { S2C } from '@cuepoint/shared'

type RoomParams = { roomId: string }
type LabelParams = { roomId: string; labelId: string }

const CreateLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #3b82f6'),
})

export function makeLabelsRouter(io: SocketIOServer) {
  const router = Router({ mergeParams: true })

  function broadcast(roomId: string, event: string, payload: unknown) {
    io.to(`room:${roomId}`).emit(event, payload)
  }

  router.get('/', async (req: Request<RoomParams>, res) => {
    const roomId = req.params.roomId
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })
    const labels = await prisma.label.findMany({ where: { roomId: room.id } })
    return res.json(labels)
  })

  router.post('/', async (req: Request<RoomParams>, res) => {
    const roomId = req.params.roomId
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const parsed = CreateLabelSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    try {
      const label = await prisma.label.create({
        data: { roomId: room.id, name: parsed.data.name, color: parsed.data.color },
      })
      broadcast(room.id, S2C.ROOM_STATE, await fullRoomSnapshot(room.id))
      return res.status(201).json(label)
    } catch {
      return res.status(409).json({ error: 'label_name_taken' })
    }
  })

  router.patch('/:labelId', async (req: Request<LabelParams>, res) => {
    const roomId = req.params.roomId
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const parsed = CreateLabelSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const label = await prisma.label.findFirst({
      where: { id: req.params.labelId, roomId: room.id },
    })
    if (!label) return res.status(404).json({ error: 'not_found' })

    const updated = await prisma.label.update({ where: { id: label.id }, data: parsed.data })
    broadcast(room.id, S2C.ROOM_STATE, await fullRoomSnapshot(room.id))
    return res.json(updated)
  })

  router.delete('/:labelId', async (req: Request<LabelParams>, res) => {
    const roomId = req.params.roomId
    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const label = await prisma.label.findFirst({
      where: { id: req.params.labelId, roomId: room.id },
    })
    if (!label) return res.status(404).json({ error: 'not_found' })

    // Remove this label from all timers that reference it
    const affectedTimers = await prisma.timer.findMany({
      where: { roomId: room.id, labelIds: { has: label.id } },
      select: { id: true, labelIds: true },
    })
    await Promise.all(
      affectedTimers.map((t) =>
        prisma.timer.update({
          where: { id: t.id },
          data: { labelIds: { set: t.labelIds.filter((lid) => lid !== label.id) } },
        })
      )
    )
    await prisma.label.delete({ where: { id: label.id } })
    broadcast(room.id, S2C.ROOM_STATE, await fullRoomSnapshot(room.id))
    return res.status(204).end()
  })

  return router
}

async function fullRoomSnapshot(roomId: string) {
  return prisma.room.findFirst({
    where: { id: roomId },
    include: {
      timers: { orderBy: { order: 'asc' } },
      messages: { orderBy: { order: 'asc' } },
      labels: true,
      submitConfig: true,
    },
  })
}
