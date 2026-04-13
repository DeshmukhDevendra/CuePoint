import { Router } from 'express'
import { prisma } from '@cuepoint/db'
import { requireUser } from '../auth/middleware.js'

export const logsRouter = Router({ mergeParams: true })

logsRouter.get('/', requireUser, async (req, res) => {
  const roomId = req.params['roomId']!
  // Verify ownership
  const room = await prisma.room.findFirst({
    where: { id: roomId, ownerId: req.user!.id, deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })

  const limit = Math.min(Number(req.query['limit'] ?? 100), 500)
  const cursor = req.query['cursor'] as string | undefined

  const logs = await prisma.log.findMany({
    where: { roomId: room.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { actor: { select: { id: true, name: true, email: true } } },
  })

  const hasMore = logs.length > limit
  if (hasMore) logs.pop()

  return res.json({
    logs,
    nextCursor: hasMore ? logs[logs.length - 1]?.id : null,
  })
})
