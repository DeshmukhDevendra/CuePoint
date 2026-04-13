import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/cn'

interface AnalyticsEvent {
  id: string
  roomId: string
  eventType: string
  timerId: string | null
  durationMs: number | null
  overUnderMs: number | null
  metadata: { title?: string } | null
  createdAt: string
}

interface TimerBreakdown {
  timerId: string
  title: string
  runs: number
  avgDurationMs: number | null
  avgOverUnderMs: number | null
}

interface AnalyticsData {
  room: { id: string; title: string }
  summary: {
    totalEvents: number
    timersStarted: number
    timersCompleted: number
    avgOverUnderMs: number | null
  }
  recentEvents: AnalyticsEvent[]
  timerBreakdown: TimerBreakdown[]
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  const abs = Math.abs(ms)
  const s = Math.floor(abs / 1000)
  const m = Math.floor(s / 60)
  const sRem = s % 60
  const str = m > 0 ? `${m}m ${sRem}s` : `${s}s`
  return ms < 0 ? `-${str}` : str
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function AdherenceBadge({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-muted-foreground text-xs">—</span>
  const isOver = ms > 0
  const isNear = Math.abs(ms) <= 10_000 // within 10s = "on time"
  return (
    <span
      className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded-full',
        isNear
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : isOver
            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      )}
    >
      {ms > 0 ? '+' : ''}{fmtMs(ms)}
    </span>
  )
}

function eventLabel(type: string): { label: string; color: string } {
  switch (type) {
    case 'timer_started': return { label: 'Started', color: 'text-green-600 dark:text-green-400' }
    case 'timer_stopped': return { label: 'Stopped', color: 'text-orange-600 dark:text-orange-400' }
    case 'timer_expired': return { label: 'Expired', color: 'text-red-600 dark:text-red-400' }
    default: return { label: type, color: 'text-muted-foreground' }
  }
}

export function AnalyticsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return
    api
      .get<AnalyticsData>(`/rooms/${roomId}/analytics`)
      .then((d) => setData(d))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [roomId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Loading analytics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-destructive text-sm">{error ?? 'Not found'}</span>
      </div>
    )
  }

  const { summary, recentEvents, timerBreakdown } = data

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3">
        <Link
          to={`/rooms/${roomId}`}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← Controller
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold truncate max-w-[200px]">{data.room.title}</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground text-sm">Analytics</span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Timers Started</p>
            <p className="text-3xl font-bold">{summary.timersStarted}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Timers Completed</p>
            <p className="text-3xl font-bold">{summary.timersCompleted}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Avg Adherence</p>
            <p className="text-3xl font-bold">
              {summary.avgOverUnderMs == null ? (
                <span className="text-muted-foreground text-base">No data</span>
              ) : (
                <span
                  className={cn(
                    Math.abs(summary.avgOverUnderMs) <= 10_000
                      ? 'text-green-600 dark:text-green-400'
                      : summary.avgOverUnderMs > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  {summary.avgOverUnderMs > 0 ? '+' : ''}{fmtMs(summary.avgOverUnderMs)}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">over/under schedule</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Events</p>
            <p className="text-3xl font-bold">{summary.totalEvents}</p>
          </Card>
        </div>

        {summary.timersStarted === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No timer activity yet. Analytics events are recorded automatically when timers are started and stopped.
            </p>
          </Card>
        )}

        {/* Per-timer breakdown */}
        {timerBreakdown.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Timer Breakdown
            </h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timer</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Runs</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Duration</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Avg Adherence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timerBreakdown.map((t, i) => (
                      <tr key={t.timerId} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/30')}>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{t.title || 'Untitled'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.runs}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {fmtMs(t.avgDurationMs)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <AdherenceBadge ms={t.avgOverUnderMs} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Event timeline */}
        {recentEvents.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recent Events
            </h2>
            <Card>
              <div className="divide-y">
                {recentEvents.map((e) => {
                  const { label, color } = eventLabel(e.eventType)
                  const title = e.metadata?.title ?? e.timerId ?? '—'
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="text-right min-w-[80px]">
                        <p className="text-xs font-mono text-muted-foreground">{fmtTime(e.createdAt)}</p>
                        <p className="text-xs text-muted-foreground/60">{fmtDate(e.createdAt)}</p>
                      </div>
                      <div className={cn('text-xs font-semibold w-20 shrink-0', color)}>{label}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{title}</p>
                        {e.durationMs != null && (
                          <p className="text-xs text-muted-foreground">
                            Ran for {fmtMs(e.durationMs)}
                            {e.overUnderMs != null && (
                              <>
                                {' '}·{' '}
                                <span
                                  className={cn(
                                    Math.abs(e.overUnderMs) <= 10_000
                                      ? 'text-green-600 dark:text-green-400'
                                      : e.overUnderMs > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                  )}
                                >
                                  {e.overUnderMs > 0 ? '+' : ''}{fmtMs(e.overUnderMs)} vs schedule
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
