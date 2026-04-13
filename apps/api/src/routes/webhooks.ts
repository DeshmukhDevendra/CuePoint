/**
 * Session-authenticated webhook management for the Controller UI.
 * Distinct from the API v1 webhook endpoints (which use API key auth).
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@cuepoint/db'
import { requireUser } from '../auth/middleware.js'

const CreateWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().max(64)).min(1).max(20),
  secret: z.string().min(8).max(256).optional(),
})

export const webhooksRouter = Router({ mergeParams: true })

async function ownsRoom(userId: string, roomId: string) {
  return prisma.room.findFirst({ where: { id: roomId, ownerId: userId, deletedAt: null } })
}

webhooksRouter.get('/', requireUser, async (req, res) => {
  const room = await ownsRoom(req.user!.id, req.params['roomId']!)
  if (!room) return res.status(404).json({ error: 'not_found' })
  const webhooks = await prisma.webhook.findMany({
    where: { roomId: room.id },
    select: { id: true, url: true, events: true, enabled: true, createdAt: true },
  })
  return res.json(webhooks)
})

webhooksRouter.post('/', requireUser, async (req, res) => {
  const room = await ownsRoom(req.user!.id, req.params['roomId']!)
  if (!room) return res.status(404).json({ error: 'not_found' })

  const parsed = CreateWebhookSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

  const count = await prisma.webhook.count({ where: { roomId: room.id } })
  if (count >= 10) return res.status(422).json({ error: 'webhook_limit_reached' })

  const webhook = await prisma.webhook.create({
    data: { roomId: room.id, ...parsed.data },
    select: { id: true, url: true, events: true, enabled: true, createdAt: true },
  })
  return res.status(201).json(webhook)
})

webhooksRouter.delete('/:webhookId', requireUser, async (req, res) => {
  const room = await ownsRoom(req.user!.id, req.params['roomId']!)
  if (!room) return res.status(404).json({ error: 'not_found' })
  const wh = await prisma.webhook.findFirst({
    where: { id: req.params['webhookId'], roomId: room.id },
  })
  if (!wh) return res.status(404).json({ error: 'not_found' })
  await prisma.webhook.delete({ where: { id: wh.id } })
  return res.status(204).end()
})
