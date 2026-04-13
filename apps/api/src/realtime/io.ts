import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'node:http'
import type { Socket } from 'socket.io'
import { prisma } from '@cuepoint/db'
import { roomInclude } from '../lib/roomInclude.js'
import { readOutputLinkUnlockToken } from '../lib/outputLinkUnlock.js'
import { sanitizeRoomWire } from '../lib/sanitizeRoom.js'
import { C2S, S2C, type PingPayload, type JoinRoomPayload, type CursorMovePayload } from '@cuepoint/shared'
import { env } from '../env.js'
import { logger } from '../logger.js'

export function createSocketServer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    },
  })

  const socketRoomIds = new Map<string, Set<string>>()

  function trackJoin(sock: Socket, roomId: string) {
    let s = socketRoomIds.get(sock.id)
    if (!s) {
      s = new Set()
      socketRoomIds.set(sock.id, s)
    }
    s.add(roomId)
  }

  function broadcastPresence(roomId: string) {
    const count = io.sockets.adapter.rooms.get(`room:${roomId}`)?.size ?? 0
    io.to(`room:${roomId}`).emit(S2C.LIVE_CONNECTIONS, { count })
  }

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'socket connected')

    socket.on(C2S.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      if (typeof payload?.roomId !== 'string') return
      const roomId = payload.roomId

      if (typeof payload.signature === 'string' && payload.signature.length > 0) {
        const link = await prisma.outputLink.findFirst({
          where: { signature: payload.signature },
          include: { output: true },
        })
        if (
          !link ||
          link.output.roomId !== roomId ||
          (link.expiresAt && link.expiresAt < new Date())
        ) {
          logger.debug({ roomId }, 'join_room rejected: invalid output link signature')
          return
        }
        if (link.output.passwordHash) {
          const unlocked = readOutputLinkUnlockToken(socket.handshake.headers.cookie, env.AUTH_SECRET)
          if (unlocked !== link.signature) {
            logger.debug({ roomId }, 'join_room rejected: output link password not satisfied')
            return
          }
        }
      }

      await socket.join(`room:${roomId}`)
      trackJoin(socket, roomId)
      broadcastPresence(roomId)

      // Send full snapshot so the client can hydrate immediately
      try {
        const room = await prisma.room.findFirst({
          where: { id: roomId, deletedAt: null },
          include: roomInclude,
        })
        if (room) socket.emit(S2C.ROOM_STATE, sanitizeRoomWire(room))
      } catch (err) {
        logger.error({ err }, 'failed to send room state')
      }
    })

    socket.on(C2S.LEAVE_ROOM, (payload: { roomId: string }) => {
      if (typeof payload?.roomId === 'string') {
        socket.leave(`room:${payload.roomId}`)
        socketRoomIds.get(socket.id)?.delete(payload.roomId)
        broadcastPresence(payload.roomId)
      }
    })

    socket.on(C2S.CURSOR_MOVE, (payload: CursorMovePayload & { userId: string; name: string; color: string }) => {
      if (typeof payload?.roomId !== 'string') return
      // Relay to all others in the room (not sender)
      socket.to(`room:${payload.roomId}`).emit(S2C.CURSOR_MOVED, {
        userId: payload.userId,
        name: payload.name,
        color: payload.color,
        roomId: payload.roomId,
        x: payload.x,
        y: payload.y,
        over: payload.over,
      })
    })

    socket.on(C2S.PING, (payload: PingPayload) => {
      socket.emit(S2C.PONG, { clientSentAt: payload.clientSentAt, serverNow: Date.now() })
    })

    socket.on('disconnect', (reason) => {
      const rooms = socketRoomIds.get(socket.id)
      socketRoomIds.delete(socket.id)
      if (rooms) {
        setImmediate(() => {
          for (const id of rooms) {
            broadcastPresence(id)
          }
        })
      }
      logger.debug({ id: socket.id, reason }, 'socket disconnected')
    })
  })

  return io
}
