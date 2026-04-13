import { Router } from 'express'
import { prisma, Prisma } from '@cuepoint/db'
import { UpdateRoomLiveSchema, S2C } from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { assertRoomControl } from '../auth/roomControl.js'

export function makeRoomLiveRouter(io: SocketIOServer) {
  const router = Router({ mergeParams: true })

  router.patch('/', async (req, res) => {
    const roomId = (req.params as { roomId?: string }).roomId
    if (!roomId) return res.status(400).json({ error: 'invalid_input' })

    const room = await assertRoomControl(req, roomId)
    if (!room) return res.status(404).json({ error: 'not_found' })

    const parsed = UpdateRoomLiveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const { onAir, blackout, viewerAccess } = parsed.data
    const prevSettings =
      room.settings && typeof room.settings === 'object' && !Array.isArray(room.settings)
        ? { ...(room.settings as Record<string, unknown>) }
        : {}

    if (viewerAccess !== undefined) {
      prevSettings['viewerAccess'] = viewerAccess
    }

    const data: Prisma.RoomUpdateInput = {}
    if (onAir !== undefined) data.onAir = onAir
    if (blackout !== undefined) data.blackout = blackout
    if (viewerAccess !== undefined) {
      data.settings = prevSettings as Prisma.InputJsonValue
    }

    if (Object.keys(data).length === 0) {
      return res.json(room)
    }

    const updated = await prisma.room.update({
      where: { id: room.id },
      data,
    })

    io.to(`room:${room.id}`).emit(S2C.ROOM_FIELDS_UPDATED, {
      onAir: updated.onAir,
      blackout: updated.blackout,
      settings: updated.settings,
    })

    return res.json(updated)
  })

  return router
}
