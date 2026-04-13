import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Timer } from '@cuepoint/db'
import { useRoom } from '@/hooks/useRoom'
import { useTimerDisplay } from '@/hooks/useTimer'
import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'
import { cn } from '@/lib/cn'

function timerAction(roomId: string, timerId: string, action: string, adjustMs?: number) {
  return api.post(
    `/rooms/${roomId}/timers/${timerId}/action`,
    { action, adjustMs },
    roomControlInit(roomId)
  )
}

function BigReadout({ timer }: { timer: Timer }) {
  const { display, phase } = useTimerDisplay(timer)
  return (
    <div
      className={cn(
        'font-mono text-6xl sm:text-7xl font-bold tabular-nums text-center py-6',
        phase === 'yellow' && 'text-yellow-500',
        phase === 'red' && 'text-red-500',
        phase === 'over' && 'text-red-400 animate-pulse'
      )}
    >
      {display}
    </div>
  )
}

export function OperatorPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, loading, writeAccess } = useRoom(roomId!, 'controller')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!room?.timers.length) return
    setSelectedId((id) => {
      if (id && room.timers.some((t) => t.id === id)) return id
      return room.timers[0]!.id
    })
  }, [room])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>
  }
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
        <p>No access to this room (sign in, guest token, or open from controller device).</p>
      </div>
    )
  }

  const selected = room.timers.find((t) => t.id === selectedId) ?? room.timers[0] ?? null
  const can = writeAccess

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <h1 className="text-center text-lg font-semibold mb-2 truncate">{room.title}</h1>
      <p className="text-center text-xs text-muted-foreground mb-6">Operator — large controls</p>

      {!can && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5 p-3 text-sm text-center text-amber-200/90">
          Read-only: use the device that has controller access.
        </Card>
      )}

      <Card className="max-w-lg mx-auto p-4 space-y-4">
        <label className="block text-sm font-medium">Timer</label>
        <select
          className="w-full h-12 rounded-md border bg-background px-3 text-base"
          value={selected?.id ?? ''}
          disabled={!room.timers.length}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {room.timers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title ?? 'Untitled'} {t.isRunning ? '(live)' : ''}
            </option>
          ))}
        </select>

        {selected && <BigReadout timer={selected} />}

        {selected && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              className="h-14 text-lg bg-green-600 hover:bg-green-700 text-white"
              disabled={!can || selected.isRunning}
              onClick={() => void timerAction(room.id, selected.id, selected.elapsedMs > 0 ? 'resume' : 'start')}
            >
              {selected.elapsedMs > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button
              type="button"
              className="h-14 text-lg bg-yellow-500 hover:bg-yellow-600 text-black"
              disabled={!can || !selected.isRunning}
              onClick={() => void timerAction(room.id, selected.id, 'pause')}
            >
              Pause
            </Button>
            <Button
              type="button"
              className="h-14 text-lg bg-muted text-foreground"
              disabled={!can}
              onClick={() => void timerAction(room.id, selected.id, 'stop')}
            >
              Stop
            </Button>
            <Button
              type="button"
              className="h-14 text-lg bg-muted text-foreground"
              disabled={!can}
              onClick={() => void timerAction(room.id, selected.id, 'reset')}
            >
              Reset
            </Button>
            <Button
              type="button"
              className="h-14 text-lg bg-muted text-foreground col-span-2"
              disabled={!can}
              onClick={() => void timerAction(room.id, selected.id, 'adjust', 60_000)}
            >
              -1 min on clock
            </Button>
            <Button
              type="button"
              className="h-14 text-lg bg-muted text-foreground col-span-2"
              disabled={!can}
              onClick={() => void timerAction(room.id, selected.id, 'adjust', -60_000)}
            >
              +1 min on clock
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
