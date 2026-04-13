import { useParams } from 'react-router-dom'
import type { Timer } from '@cuepoint/db'
import { useRoom } from '@/hooks/useRoom'
import { useTimerDisplay } from '@/hooks/useTimer'
import { formatDuration, applyPlaceholders } from '@cuepoint/shared'
import { cn } from '@/lib/cn'

function AgendaRow({ timer, roomTitle }: { timer: Timer; roomTitle: string }) {
  const { display } = useTimerDisplay(timer)
  const title = applyPlaceholders(timer.title ?? '', {
    roomTitle,
    timerTitle: timer.title ?? undefined,
    speaker: timer.speaker ?? undefined,
  })
  return (
    <tr className="border-b border-zinc-800/80 last:border-0">
      <td className="py-3 px-4 text-zinc-500">{timer.order + 1}</td>
      <td className="py-3 px-4 font-medium">{title || '—'}</td>
      <td className="py-3 px-4 text-sm text-zinc-400">{timer.speaker ?? '—'}</td>
      <td className="py-3 px-4 font-mono text-sm tabular-nums text-zinc-400">{formatDuration(timer.durationMs)}</td>
      <td className="py-3 px-4">
        <span
          className={cn(
            'rounded px-2 py-0.5 text-xs font-medium',
            timer.isRunning ? 'bg-green-600/20 text-green-400' : 'bg-muted text-muted-foreground'
          )}
        >
          {timer.isRunning ? 'Live' : 'Ready'}
        </span>
      </td>
      <td className="py-3 px-4 font-mono tabular-nums text-sm">{display}</td>
    </tr>
  )
}

export function AgendaPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, loading } = useRoom(roomId!, 'viewer', { publicFor: 'agenda' })

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-200">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 border-b border-zinc-800 pb-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Agenda</p>
          <h1 className="text-2xl md:text-3xl font-semibold">{room.title}</h1>
        </header>
        {room.timers.length === 0 ? (
          <p className="text-sm text-zinc-500">No agenda items yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-900/50">
                  <th className="py-3 px-4 font-medium">#</th>
                  <th className="py-3 px-4 font-medium">Item</th>
                  <th className="py-3 px-4 font-medium">Speaker</th>
                  <th className="py-3 px-4 font-medium">Planned</th>
                  <th className="py-3 px-4 font-medium">State</th>
                  <th className="py-3 px-4 font-medium">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {room.timers.map((t) => (
                  <AgendaRow key={t.id} timer={t} roomTitle={room.title} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
