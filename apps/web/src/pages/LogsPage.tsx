import { useParams, Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button, Card } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeToggle'

interface LogEntry {
  id: string
  action: string
  metadata: unknown
  createdAt: string
  actor: { id: string; name: string | null; email: string } | null
}

interface LogsResponse {
  logs: LogEntry[]
  nextCursor: string | null
}

const ACTION_LABELS: Record<string, string> = {
  timer_started: '▶ Timer started',
  timer_stopped: '■ Timer stopped',
  timer_paused: '⏸ Timer paused',
  timer_reset: '↺ Timer reset',
  timer_created: '+ Timer created',
  timer_deleted: '✕ Timer deleted',
  message_shown: '💬 Message shown',
  message_hidden: '💬 Message hidden',
  on_air_on: '🔴 On air',
  on_air_off: '⚪ Off air',
  blackout_on: '⬛ Blackout on',
  blackout_off: '⬜ Blackout off',
}

export function LogsPage() {
  const { roomId } = useParams<{ roomId: string }>()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['room-logs', roomId],
    queryFn: ({ pageParam }) =>
      api.get<LogsResponse>(`/rooms/${roomId}/logs?limit=50${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })

  const allLogs = data?.pages.flatMap((p) => p.logs) ?? []

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to={`/rooms/${roomId}`} className="text-muted-foreground hover:text-foreground text-sm">
            ← Controller
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">Room Logs</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-3">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {!isLoading && allLogs.length === 0 && (
          <Card className="text-center text-muted-foreground">No logs yet.</Card>
        )}

        {allLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-4 rounded-lg border bg-card px-4 py-3 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</p>
              {log.metadata != null && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {JSON.stringify(log.metadata)}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleTimeString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {log.actor?.name ?? log.actor?.email ?? 'Guest'}
              </p>
            </div>
          </div>
        ))}

        {hasNextPage && (
          <div className="text-center pt-2">
            <Button
              className="bg-muted text-foreground hover:opacity-80"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
