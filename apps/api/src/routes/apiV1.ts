/**
 * CuePoint HTTP API v1
 *
 * Auth: Authorization: Bearer <room-api-key>
 * All routes are scoped to the room identified by the API key.
 *
 * Timer actions  POST /api/v1/timers/:id/start|stop|pause|resume|reset|adjust
 * Messages       GET  /api/v1/messages
 *                POST /api/v1/messages/:id/show|hide
 * Room state     GET  /api/v1/room
 *                PATCH /api/v1/room   { onAir?, blackout? }
 * Webhooks       GET/POST /api/v1/webhooks
 *                DELETE  /api/v1/webhooks/:id
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@cuepoint/db'
import { S2C } from '@cuepoint/shared'
import type { Server as SocketIOServer } from 'socket.io'
import { requireApiKey } from '../auth/apiKeyMiddleware.js'
import { makeApiV1Limiter } from '../lib/rateLimiter.js'
import { enqueueWebhook } from '../queue/webhooks.js'

const AdjustSchema = z.object({ adjustMs: z.number().int() })

const UpdateRoomLiveSchema = z.object({
  onAir: z.boolean().optional(),
  blackout: z.boolean().optional(),
})

const CreateWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().max(64)).min(1).max(20),
  secret: z.string().min(8).max(256).optional(),
})

export function makeApiV1Router(io: SocketIOServer) {
  const router = Router()
  const limiter = makeApiV1Limiter()

  router.use(limiter)
  router.use(requireApiKey)

  function broadcast(roomId: string, event: string, payload: unknown) {
    io.to(`room:${roomId}`).emit(event, payload)
  }

  // ── Room state ──────────────────────────────────────────────

  router.get('/room', async (req, res) => {
    const room = await prisma.room.findFirst({
      where: { id: req.apiRoom!.id },
      include: {
        timers: { orderBy: { order: 'asc' } },
        messages: { orderBy: { order: 'asc' } },
        labels: true,
      },
    })
    return res.json(room)
  })

  router.patch('/room', async (req, res) => {
    const parsed = UpdateRoomLiveSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })

    const room = await prisma.room.update({
      where: { id: req.apiRoom!.id },
      data: parsed.data,
    })
    broadcast(room.id, S2C.ROOM_FIELDS_UPDATED, parsed.data)
    void enqueueWebhook(room.id, parsed.data.onAir !== undefined ? 'room.on_air' : 'room.blackout', parsed.data)
    return res.json({ ok: true })
  })

  // ── Timers ───────────────────────────────────────────────────

  router.get('/timers', async (req, res) => {
    const timers = await prisma.timer.findMany({
      where: { roomId: req.apiRoom!.id },
      orderBy: { order: 'asc' },
    })
    return res.json(timers)
  })

  async function timerAction(req: import('express').Request, res: import('express').Response, action: string) {
    const timer = await prisma.timer.findFirst({
      where: { id: req.params['timerId'], roomId: req.apiRoom!.id },
    })
    if (!timer) return res.status(404).json({ error: 'not_found' })

    const now = new Date()
    let update: Record<string, unknown> = {}

    switch (action) {
      case 'start':
        update = { isRunning: true, startedAt: now, pausedAt: null, elapsedMs: 0 }
        break
      case 'stop':
      case 'reset':
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
      case 'adjust': {
        const parsed = AdjustSchema.safeParse(req.body)
        if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
        const newElapsed = Math.max(0, timer.elapsedMs + parsed.data.adjustMs)
        update = { elapsedMs: newElapsed, ...(timer.isRunning ? { startedAt: now } : {}) }
        break
      }
    }

    const updated = await prisma.timer.update({ where: { id: timer.id }, data: update })
    broadcast(req.apiRoom!.id, S2C.TIMER_UPDATED, updated)

    // Fire webhook for meaningful state changes
    const webhookEvent = action === 'start' || action === 'resume'
      ? 'timer.started'
      : action === 'stop' || action === 'reset'
        ? 'timer.stopped'
        : action === 'pause'
          ? 'timer.paused'
          : null
    if (webhookEvent) {
      void enqueueWebhook(req.apiRoom!.id, webhookEvent, {
        timerId: timer.id,
        title: timer.title,
        durationMs: timer.durationMs,
      })
    }

    return res.json(updated)
  }

  router.post('/timers/:timerId/start',  (req, res) => timerAction(req, res, 'start'))
  router.post('/timers/:timerId/stop',   (req, res) => timerAction(req, res, 'stop'))
  router.post('/timers/:timerId/pause',  (req, res) => timerAction(req, res, 'pause'))
  router.post('/timers/:timerId/resume', (req, res) => timerAction(req, res, 'resume'))
  router.post('/timers/:timerId/reset',  (req, res) => timerAction(req, res, 'reset'))
  router.post('/timers/:timerId/adjust', (req, res) => timerAction(req, res, 'adjust'))

  // ── Messages ─────────────────────────────────────────────────

  router.get('/messages', async (req, res) => {
    const messages = await prisma.message.findMany({
      where: { roomId: req.apiRoom!.id },
      orderBy: { order: 'asc' },
    })
    return res.json(messages)
  })

  router.post('/messages/:messageId/show', async (req, res) => {
    const msg = await prisma.message.findFirst({
      where: { id: req.params['messageId'], roomId: req.apiRoom!.id },
    })
    if (!msg) return res.status(404).json({ error: 'not_found' })
    const updated = await prisma.message.update({ where: { id: msg.id }, data: { visible: true } })
    broadcast(req.apiRoom!.id, S2C.MESSAGE_UPDATED, updated)
    return res.json(updated)
  })

  router.post('/messages/:messageId/hide', async (req, res) => {
    const msg = await prisma.message.findFirst({
      where: { id: req.params['messageId'], roomId: req.apiRoom!.id },
    })
    if (!msg) return res.status(404).json({ error: 'not_found' })
    const updated = await prisma.message.update({ where: { id: msg.id }, data: { visible: false } })
    broadcast(req.apiRoom!.id, S2C.MESSAGE_UPDATED, updated)
    return res.json(updated)
  })

  // ── Webhooks ─────────────────────────────────────────────────

  router.get('/webhooks', async (req, res) => {
    const webhooks = await prisma.webhook.findMany({
      where: { roomId: req.apiRoom!.id },
      select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    })
    return res.json(webhooks)
  })

  router.post('/webhooks', async (req, res) => {
    const parsed = CreateWebhookSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

    const count = await prisma.webhook.count({ where: { roomId: req.apiRoom!.id } })
    if (count >= 10) return res.status(422).json({ error: 'webhook_limit_reached' })

    const webhook = await prisma.webhook.create({
      data: { roomId: req.apiRoom!.id, ...parsed.data },
      select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    })
    return res.status(201).json(webhook)
  })

  router.patch('/webhooks/:webhookId', async (req, res) => {
    const wh = await prisma.webhook.findFirst({
      where: { id: req.params['webhookId'], roomId: req.apiRoom!.id },
    })
    if (!wh) return res.status(404).json({ error: 'not_found' })
    const parsed = CreateWebhookSchema.partial().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })
    const updated = await prisma.webhook.update({
      where: { id: wh.id },
      data: parsed.data,
      select: { id: true, url: true, events: true, enabled: true, createdAt: true },
    })
    return res.json(updated)
  })

  router.delete('/webhooks/:webhookId', async (req, res) => {
    const wh = await prisma.webhook.findFirst({
      where: { id: req.params['webhookId'], roomId: req.apiRoom!.id },
    })
    if (!wh) return res.status(404).json({ error: 'not_found' })
    await prisma.webhook.delete({ where: { id: wh.id } })
    return res.status(204).end()
  })

  return router
}
