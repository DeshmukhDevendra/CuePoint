/**
 * Analytics API — session-authenticated, owner/team-member access.
 *
 * GET /api/rooms/:roomId/analytics   — summary + recent events + per-timer breakdown
 */
import { Router } from 'express'
import { prisma } from '@cuepoint/db'
import { requireUser } from '../auth/middleware.js'

export const analyticsRouter = Router({ mergeParams: true })

analyticsRouter.use(requireUser)

analyticsRouter.get('/', async (req, res) => {
  const { roomId } = req.params as { roomId: string }
  const userId = req.user!.id

  // Allow owner OR any team member of the room's team
  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { team: { members: { some: { userId } } } },
      ],
    },
    select: { id: true, title: true, teamId: true },
  })
  if (!room) return res.status(404).json({ error: 'not_found' })

  // Fetch all events for this room
  const events = await prisma.analyticsEvent.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Summary stats
  const started = events.filter((e) => e.eventType === 'timer_started').length
  const completed = events.filter(
    (e) => e.eventType === 'timer_stopped' || e.eventType === 'timer_expired'
  )
  const withAdherence = completed.filter((e) => e.overUnderMs !== null)
  const avgOverUnderMs =
    withAdherence.length > 0
      ? Math.round(withAdherence.reduce((s, e) => s + (e.overUnderMs ?? 0), 0) / withAdherence.length)
      : null

  // Per-timer breakdown
  const timerMap = new Map<
    string,
    { timerId: string; title: string; runs: number; totalDurationMs: number; totalOverUnderMs: number; count: number }
  >()

  for (const e of events) {
    if (!e.timerId) continue
    const title = (e.metadata as { title?: string } | null)?.title ?? e.timerId
    const key = e.timerId
    const existing = timerMap.get(key) ?? { timerId: e.timerId, title, runs: 0, totalDurationMs: 0, totalOverUnderMs: 0, count: 0 }

    if (e.eventType === 'timer_started') {
      existing.runs += 1
    }
    if ((e.eventType === 'timer_stopped' || e.eventType === 'timer_expired') && e.durationMs != null) {
      existing.totalDurationMs += e.durationMs
      if (e.overUnderMs != null) {
        existing.totalOverUnderMs += e.overUnderMs
        existing.count += 1
      }
    }
    timerMap.set(key, existing)
  }

  const timerBreakdown = Array.from(timerMap.values()).map((t) => ({
    timerId: t.timerId,
    title: t.title,
    runs: t.runs,
    avgDurationMs: t.count > 0 ? Math.round(t.totalDurationMs / t.count) : null,
    avgOverUnderMs: t.count > 0 ? Math.round(t.totalOverUnderMs / t.count) : null,
  }))

  return res.json({
    room: { id: room.id, title: room.title },
    summary: {
      totalEvents: events.length,
      timersStarted: started,
      timersCompleted: completed.length,
      avgOverUnderMs,
    },
    recentEvents: events.slice(0, 50),
    timerBreakdown,
  })
})
