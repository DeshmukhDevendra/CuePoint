import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma, Prisma } from '@cuepoint/db'
import { ClaimRoomSchema, CreateRoomSchema, UpdateRoomSchema, PLAN_LIMITS, withinLimit } from '@cuepoint/shared'
import { requireUser } from '../auth/middleware.js'
import { verifyPassword } from '../auth/password.js'

export const roomsRouter = Router()

function makeApiKey() {
  return `room_${randomBytes(16).toString('hex')}`
}

// List rooms for the authenticated user
roomsRouter.get('/', requireUser, async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { ownerId: req.user!.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, timezone: true, onAir: true, apiKey: true, createdAt: true },
  })
  return res.json(rooms)
})

// Create a room
roomsRouter.post('/', requireUser, async (req, res) => {
  const parsed = CreateRoomSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
  }
  const { title, timezone, teamId } = parsed.data

  // Security: if teamId provided, verify the user is actually a member of that team
  if (teamId) {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId } },
    })
    if (!membership) return res.status(403).json({ error: 'forbidden' })
  }

  // Plan enforcement: check room limit
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { plan: true } })
    if (team) {
      const limit = PLAN_LIMITS[team.plan as keyof typeof PLAN_LIMITS]?.rooms ?? PLAN_LIMITS.FREE.rooms
      const roomCount = await prisma.room.count({ where: { teamId, deletedAt: null } })
      if (!withinLimit(roomCount, limit)) {
        return res.status(402).json({ error: 'plan_limit_reached', limit_type: 'rooms', current: roomCount, limit })
      }
    }
  } else {
    // Personal rooms: apply FREE limits
    const limit = PLAN_LIMITS.FREE.rooms
    const roomCount = await prisma.room.count({ where: { ownerId: req.user!.id, teamId: null, deletedAt: null } })
    if (!withinLimit(roomCount, limit)) {
      return res.status(402).json({ error: 'plan_limit_reached', limit_type: 'rooms', current: roomCount, limit })
    }
  }

  const room = await prisma.room.create({
    data: { title, timezone, ownerId: req.user!.id, teamId: teamId ?? null, apiKey: makeApiKey() },
  })
  await prisma.submitQuestionConfig.create({
    data: {
      roomId: room.id,
      enabled: true,
      title: 'Ask a question',
      subtitle: 'Your question may be reviewed before it appears on screen.',
      questionLabel: 'Your question',
      nameLabel: 'Your name',
    },
  })
  return res.status(201).json(room)
})

// Attach a guest room to the signed-in user (requires controller secret)
roomsRouter.post('/:roomId/claim', requireUser, async (req, res) => {
  const parsed = ClaimRoomSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
  }

  const room = await prisma.room.findFirst({
    where: { id: req.params['roomId'], deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })
  if (room.ownerId) return res.status(409).json({ error: 'already_owned' })
  if (!room.anonymousControllerSecretHash) {
    return res.status(403).json({ error: 'cannot_claim' })
  }

  let ok = false
  try {
    ok = await verifyPassword(room.anonymousControllerSecretHash, parsed.data.controllerToken)
  } catch {
    return res.status(403).json({ error: 'invalid_token' })
  }
  if (!ok) return res.status(403).json({ error: 'invalid_token' })

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { ownerId: req.user!.id, anonymousControllerSecretHash: null },
    include: {
      timers: { orderBy: { order: 'asc' } },
      messages: { orderBy: { order: 'asc' } },
      labels: true,
      submitConfig: true,
    },
  })
  return res.json(updated)
})

// Get a single room (with timers + messages) — accessible by owner or any team member
roomsRouter.get('/:roomId', requireUser, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: {
      id: req.params['roomId'],
      deletedAt: null,
      OR: [
        { ownerId: req.user!.id },
        { team: { members: { some: { userId: req.user!.id } } } },
      ],
    },
    include: {
      timers: { orderBy: { order: 'asc' } },
      messages: { orderBy: { order: 'asc' } },
      labels: true,
      submitConfig: true,
    },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })
  return res.json(room)
})

// Update a room
roomsRouter.patch('/:roomId', requireUser, async (req, res) => {
  const parsed = UpdateRoomSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
  }
  const room = await prisma.room.findFirst({
    where: { id: req.params['roomId'], ownerId: req.user!.id, deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })

  const { settings, ...rest } = parsed.data
  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      ...rest,
      ...(settings !== undefined ? { settings: settings as Prisma.InputJsonValue } : {}),
    },
  })
  return res.json(updated)
})

// Regenerate a room's API key
roomsRouter.post('/:roomId/regenerate-key', requireUser, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params['roomId'], ownerId: req.user!.id, deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })
  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { apiKey: makeApiKey() },
    select: { id: true, apiKey: true },
  })
  return res.json(updated)
})

// Soft-delete a room
roomsRouter.delete('/:roomId', requireUser, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params['roomId'], ownerId: req.user!.id, deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })

  await prisma.room.update({ where: { id: room.id }, data: { deletedAt: new Date() } })
  return res.status(204).end()
})
