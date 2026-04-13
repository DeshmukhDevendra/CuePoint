import { Router, type Request, type Response } from 'express'
import { prisma } from '@cuepoint/db'
import { CreateTimerSchema, UpdateTimerSchema, TimerActionSchema, ReorderTimersSchema } from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { S2C } from '@cuepoint/shared'
import { assertRoomControl } from '../auth/roomControl.js'
import type { Room, Timer } from '@cuepoint/db'
import { scheduleTimer, cancelScheduledTimer } from '../queue/scheduledTimers.js'

type RoomParams = { roomId?: string }

export function makeTimersRouter(io: SocketIOServer) {
  const router = Router({ mergeParams: true })

  function roomIdFrom(req: Request): string | undefined {
    return (req.params as RoomParams).roomId
  }

  async function requireControl(req: Request, res: Response, roomId: string): Promise<Room | null> {
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

  /** Sync a BullMQ job for scheduled timers. No-op if queue not initialised. */
  async function syncScheduledJob(timer: Timer) {
    try {
      if (timer.triggerType === 'SCHEDULED' && timer.startTime) {
        await scheduleTimer(timer.id, timer.roomId, new Date(timer.startTime))
      } else {
        await cancelScheduledTimer(timer.id)
      }
    } catch {
      // Queue not available (no Redis) — fail silently
    }
  }

  // List timers for a room
  router.get('/', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const timers = await prisma.timer.findMany({
      where: { roomId: room.id },
      orderBy: { order: 'asc' },
    })
    return res.json(timers)
  })

  // Create a timer
  router.post('/', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = CreateTimerSchema.omit({ roomId: true }).safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const maxOrder = await prisma.timer.aggregate({
      where: { roomId: room.id },
      _max: { order: true },
    })
    const order = parsed.data.order ?? (maxOrder._max.order ?? -1) + 1

    const timer = await prisma.timer.create({
      data: { ...parsed.data, order, roomId: room.id },
    })

    broadcast(room.id, S2C.TIMER_LIST_UPDATED, { type: 'created', timer })
    void syncScheduledJob(timer)
    return res.status(201).json(timer)
  })

  // Update a timer
  router.patch('/:timerId', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = UpdateTimerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
    }

    const timer = await prisma.timer.findFirst({
      where: { id: req.params['timerId'], roomId: room.id },
    })
    if (!timer) return res.status(404).json({ error: 'not_found' })

    const updated = await prisma.timer.update({ where: { id: timer.id }, data: parsed.data })
    broadcast(room.id, S2C.TIMER_UPDATED, updated)
    void syncScheduledJob(updated)
    return res.json(updated)
  })

  // Delete a timer
  router.delete('/:timerId', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const timer = await prisma.timer.findFirst({
      where: { id: req.params['timerId'], roomId: room.id },
    })
    if (!timer) return res.status(404).json({ error: 'not_found' })

    await prisma.timer.delete({ where: { id: timer.id } })
    void cancelScheduledTimer(timer.id)
    broadcast(room.id, S2C.TIMER_LIST_UPDATED, { type: 'deleted', timerId: timer.id })
    return res.status(204).end()
  })

  // Reorder timers
  router.put('/reorder', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = ReorderTimersSchema.safeParse({ ...req.body, roomId: room.id })
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input' })
    }

    await Promise.all(
      parsed.data.orderedIds.map((id, index) =>
        prisma.timer.updateMany({ where: { id, roomId: room.id }, data: { order: index } })
      )
    )

    const timers = await prisma.timer.findMany({
      where: { roomId: room.id },
      orderBy: { order: 'asc' },
    })
    broadcast(room.id, S2C.TIMER_LIST_UPDATED, { type: 'reordered', timers })
    return res.json(timers)
  })

  // Timer transport action: start | stop | pause | resume | reset | adjust
  router.post('/:timerId/action', async (req, res) => {
    const rid = roomIdFrom(req)
    if (!rid) return res.status(400).json({ error: 'invalid_input' })
    const room = await requireControl(req, res, rid)
    if (!room) return

    const parsed = TimerActionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input' })
    }

    const timer = await prisma.timer.findFirst({
      where: { id: req.params['timerId'], roomId: room.id },
    })
    if (!timer) return res.status(404).json({ error: 'not_found' })

    const now = new Date()
    let update: Parameters<typeof prisma.timer.update>[0]['data'] = {}

    switch (parsed.data.action) {
      case 'start':
        update = { isRunning: true, startedAt: now, pausedAt: null, elapsedMs: 0 }
        break
      case 'stop':
        update = { isRunning: false, startedAt: null, pausedAt: null, elapsedMs: 0 }
        break
      case 'pause': {
        if (!timer.isRunning || !timer.startedAt) break
        const elapsed = timer.elapsedMs + (now.getTime() - timer.startedAt.getTime())
        update = { isRunning: false, pausedAt: now, elapsedMs: elapsed }
        break
      }
      case 'resume':
        if (timer.isRunning) break
        update = { isRunning: true, startedAt: now, pausedAt: null }
        break
      case 'reset':
        update = { isRunning: false, startedAt: null, pausedAt: null, elapsedMs: 0 }
        break
      case 'adjust': {
        const adj = parsed.data.adjustMs ?? 0
        const newElapsed = Math.max(0, timer.elapsedMs + adj)
        update = { elapsedMs: newElapsed, ...(timer.isRunning ? { startedAt: now } : {}) }
        break
      }
      case 'expire': {
        // Idempotent: if already stopped, do nothing
        if (!timer.isRunning) {
          return res.json(timer)
        }
        update = { isRunning: false, startedAt: null, pausedAt: null, elapsedMs: 0 }
        break
      }
    }

    const updated = await prisma.timer.update({ where: { id: timer.id }, data: update })
    broadcast(room.id, S2C.TIMER_UPDATED, updated)

    // Auto-advance: if this was an expire action, start the next LINKED timer
    if (parsed.data.action === 'expire' || parsed.data.action === 'stop') {
      const nextTimer = await prisma.timer.findFirst({
        where: { roomId: room.id, order: { gt: timer.order }, triggerType: 'LINKED' },
        orderBy: { order: 'asc' },
      })
      // Only auto-start if it's immediately next (no gap timer in between)
      const nextByOrder = await prisma.timer.findFirst({
        where: { roomId: room.id, order: { gt: timer.order } },
        orderBy: { order: 'asc' },
      })
      if (nextTimer && nextByOrder && nextTimer.id === nextByOrder.id) {
        const startedNext = await prisma.timer.update({
          where: { id: nextTimer.id },
          data: { isRunning: true, startedAt: now, pausedAt: null, elapsedMs: 0 },
        })
        broadcast(room.id, S2C.TIMER_UPDATED, startedNext)
      }
    }

    return res.json(updated)
  })

  return router
}
