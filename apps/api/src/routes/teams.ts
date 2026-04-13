/**
 * Teams API — session-authenticated.
 *
 * POST   /api/teams                    create team (current user becomes OWNER)
 * GET    /api/teams                    list teams for current user
 * GET    /api/teams/:teamId            team detail + members + rooms
 * PATCH  /api/teams/:teamId            update team name (OWNER/ADMIN)
 * DELETE /api/teams/:teamId            delete team (OWNER only)
 *
 * POST   /api/teams/:teamId/invite     invite member by email
 * GET    /api/teams/:teamId/invites    list pending invites
 * DELETE /api/teams/:teamId/invites/:inviteId  cancel invite
 *
 * PATCH  /api/teams/:teamId/members/:memberId  change role (OWNER/ADMIN)
 * DELETE /api/teams/:teamId/members/:memberId  remove member
 *
 * POST   /api/teams/accept-invite      accept an invite by token
 *
 * POST   /api/teams/:teamId/rooms/:roomId/transfer  assign room to team
 */
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { prisma } from '@cuepoint/db'
import { requireUser } from '../auth/middleware.js'
import { sendInviteEmail } from '../lib/email.js'
import { env } from '../env.js'
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  AcceptInviteSchema,
  PLAN_LIMITS,
  withinLimit,
} from '@cuepoint/shared'

export const teamsRouter = Router()
teamsRouter.use(requireUser)

function makeTeamApiKey() {
  return `team_${randomBytes(16).toString('hex')}`
}

/** Returns the membership row if user is in the team, else null. */
async function getMembership(userId: string, teamId: string) {
  return prisma.teamMember.findUnique({ where: { userId_teamId: { userId, teamId } } })
}

function canAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN'
}

// ── Create team ──────────────────────────────────────────────

teamsRouter.post('/', async (req, res) => {
  const parsed = CreateTeamSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      apiKey: makeTeamApiKey(),
      members: { create: { userId: req.user!.id, role: 'OWNER' } },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })
  return res.status(201).json(team)
})

// ── List teams ───────────────────────────────────────────────

teamsRouter.get('/', async (req, res) => {
  const memberships = await prisma.teamMember.findMany({
    where: { userId: req.user!.id },
    include: {
      team: {
        select: { id: true, name: true, plan: true, apiKey: true, createdAt: true, _count: { select: { members: true, rooms: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  return res.json(memberships.map((m) => ({ ...m.team, role: m.role })))
})

// ── Team detail ───────────────────────────────────────────────

teamsRouter.get('/:teamId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership) return res.status(404).json({ error: 'not_found' })

  const team = await prisma.team.findUnique({
    where: { id: req.params['teamId'] },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      rooms: {
        where: { deletedAt: null },
        select: { id: true, title: true, onAir: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      invites: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      },
    },
  })
  return res.json({ ...team, role: membership.role })
})

// ── Update team ───────────────────────────────────────────────

teamsRouter.patch('/:teamId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const parsed = UpdateTeamSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })

  const updated = await prisma.team.update({ where: { id: req.params['teamId'] }, data: parsed.data })
  return res.json(updated)
})

// ── Delete team ───────────────────────────────────────────────

teamsRouter.delete('/:teamId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || membership.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' })

  // Disassociate rooms before deleting team
  await prisma.room.updateMany({ where: { teamId: req.params['teamId'] }, data: { teamId: null } })
  await prisma.team.delete({ where: { id: req.params['teamId'] } })
  return res.status(204).end()
})

// ── Invites ───────────────────────────────────────────────────

teamsRouter.post('/:teamId/invite', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const parsed = InviteMemberSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })

  // Plan enforcement: check member limit before inviting
  {
    const team = await prisma.team.findUnique({ where: { id: req.params['teamId']! }, select: { plan: true } })
    const planKey = (team?.plan ?? 'FREE') as keyof typeof PLAN_LIMITS
    const limit = PLAN_LIMITS[planKey]?.teamMembers ?? PLAN_LIMITS.FREE.teamMembers
    const memberCount = await prisma.teamMember.count({ where: { teamId: req.params['teamId']! } })
    if (!withinLimit(memberCount, limit)) {
      return res.status(402).json({ error: 'plan_limit_reached', limit_type: 'team_members', current: memberCount, limit })
    }
  }

  // Check already a member
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    const alreadyMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: existing.id, teamId: req.params['teamId']! } },
    })
    if (alreadyMember) return res.status(409).json({ error: 'already_member' })
  }

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const team = await prisma.team.findUnique({
    where: { id: req.params['teamId']! },
    select: { name: true },
  })

  const invite = await prisma.teamInvite.upsert({
    where: { teamId_email: { teamId: req.params['teamId']!, email: parsed.data.email } },
    create: { teamId: req.params['teamId']!, email: parsed.data.email, role: parsed.data.role, token, expiresAt },
    update: { role: parsed.data.role, token, expiresAt },
    select: { id: true, email: true, role: true, token: true, expiresAt: true },
  })

  const inviteUrl = `${env.WEB_BASE_URL}/accept-invite?token=${invite.token}`
  const inviterName = req.user!.name ?? req.user!.email ?? 'A teammate'

  const emailSent = await sendInviteEmail({
    to: invite.email,
    teamName: team?.name ?? 'the team',
    inviterName,
    inviteUrl,
    role: invite.role,
    expiresAt: invite.expiresAt,
  })

  return res.status(201).json({ ...invite, emailSent })
})

teamsRouter.get('/:teamId/invites', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const invites = await prisma.teamInvite.findMany({
    where: { teamId: req.params['teamId'], expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return res.json(invites)
})

teamsRouter.delete('/:teamId/invites/:inviteId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  await prisma.teamInvite.deleteMany({
    where: { id: req.params['inviteId'], teamId: req.params['teamId'] },
  })
  return res.status(204).end()
})

// Accept invite (no teamId in URL — token is self-describing)
teamsRouter.post('/accept-invite', async (req, res) => {
  const parsed = AcceptInviteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })

  const invite = await prisma.teamInvite.findUnique({ where: { token: parsed.data.token } })
  if (!invite || invite.expiresAt < new Date()) return res.status(404).json({ error: 'invite_not_found' })

  // Add as member (upsert in case they already exist with a different role)
  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: req.user!.id, teamId: invite.teamId } },
    create: { userId: req.user!.id, teamId: invite.teamId, role: invite.role },
    update: { role: invite.role },
  })
  await prisma.teamInvite.delete({ where: { id: invite.id } })
  return res.json({ teamId: invite.teamId })
})

// ── Members ───────────────────────────────────────────────────

teamsRouter.patch('/:teamId/members/:memberId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const parsed = UpdateMemberRoleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' })

  // Cannot demote last owner
  if (parsed.data.role !== 'OWNER') {
    const target = await prisma.teamMember.findUnique({ where: { id: req.params['memberId'] } })
    if (target?.role === 'OWNER') {
      const ownerCount = await prisma.teamMember.count({ where: { teamId: req.params['teamId'], role: 'OWNER' } })
      if (ownerCount <= 1) return res.status(422).json({ error: 'last_owner' })
    }
  }

  const updated = await prisma.teamMember.update({
    where: { id: req.params['memberId'] },
    data: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  return res.json(updated)
})

teamsRouter.delete('/:teamId/members/:memberId', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const target = await prisma.teamMember.findUnique({ where: { id: req.params['memberId'] } })
  if (!target || target.teamId !== req.params['teamId']) return res.status(404).json({ error: 'not_found' })

  // Cannot remove last owner
  if (target.role === 'OWNER') {
    const ownerCount = await prisma.teamMember.count({ where: { teamId: req.params['teamId'], role: 'OWNER' } })
    if (ownerCount <= 1) return res.status(422).json({ error: 'last_owner' })
  }

  await prisma.teamMember.delete({ where: { id: target.id } })
  return res.status(204).end()
})

// ── Room transfer ─────────────────────────────────────────────

teamsRouter.post('/:teamId/rooms/:roomId/transfer', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || !canAdmin(membership.role)) return res.status(403).json({ error: 'forbidden' })

  const room = await prisma.room.findFirst({
    where: { id: req.params['roomId'], ownerId: req.user!.id, deletedAt: null },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: { teamId: req.params['teamId'] },
  })
  return res.json(updated)
})

// Regenerate team API key (OWNER only)
teamsRouter.post('/:teamId/regenerate-key', async (req, res) => {
  const membership = await getMembership(req.user!.id, req.params['teamId']!)
  if (!membership || membership.role !== 'OWNER') return res.status(403).json({ error: 'forbidden' })

  const updated = await prisma.team.update({
    where: { id: req.params['teamId'] },
    data: { apiKey: makeTeamApiKey() },
    select: { id: true, apiKey: true },
  })
  return res.json(updated)
})
