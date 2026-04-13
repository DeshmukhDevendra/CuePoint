import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { Timer } from '@cuepoint/db'
import { useRoom } from '@/hooks/useRoom'
import { useTimerDisplay } from '@/hooks/useTimer'
import { applyPlaceholders } from '@cuepoint/shared'
import { cn } from '@/lib/cn'

function BigCountdown({ timer }: { timer: Timer }) {
  const { display, phase } = useTimerDisplay(timer)
  return (
    <div
      className={cn(
        'font-mono font-black tabular-nums text-[12vw] lg:text-[8vw] leading-none',
        phase === 'yellow' && 'text-amber-400',
        phase === 'red' && 'text-red-400',
        phase === 'over' && 'text-red-200 animate-pulse'
      )}
    >
      {display}
    </div>
  )
}

export function ModeratorPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, loading } = useRoom(roomId!, 'viewer', { publicFor: 'moderator' })

  const activeTimer = room?.timers.find((t) => t.isRunning) ?? room?.timers[0] ?? null

  const heroMessage = useMemo(() => {
    if (!room) return null
    const visible = room.messages.filter((m) => m.visible)
    const focused = visible.find((m) => m.focus)
    return focused ?? visible[0] ?? null
  }, [room])

  const heroText = heroMessage
    ? applyPlaceholders(heroMessage.text, {
        roomTitle: room!.title,
        timerTitle: activeTimer?.title ?? undefined,
        speaker: activeTimer?.speaker ?? undefined,
      })
    : ''

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-2 lg:gap-10 lg:p-10">
        <section className="flex flex-col justify-center gap-4">
          <p className="text-xs uppercase tracking-widest text-slate-500">Moderator</p>
          <h1 className="text-xl text-slate-400">{room.title}</h1>
          {activeTimer && (
            <>
              <p className="text-lg text-slate-300">
                {applyPlaceholders(activeTimer.title ?? 'Timer', {
                  roomTitle: room.title,
                  timerTitle: activeTimer.title ?? undefined,
                  speaker: activeTimer.speaker ?? undefined,
                })}
              </p>
              {activeTimer.speaker && (
                <p className="text-slate-500">{activeTimer.speaker}</p>
              )}
            </>
          )}
          {activeTimer ? <BigCountdown timer={activeTimer} /> : <div className="font-mono text-6xl text-slate-600">—</div>}
        </section>
        <section className="flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-800 lg:pl-10 pt-8 lg:pt-0">
          {heroMessage ? (
            <div
              className={cn(
                'rounded-2xl border border-slate-700 bg-slate-900/80 p-8 shadow-xl',
                heroMessage.flash && 'animate-pulse',
                heroMessage.bold && 'font-bold',
                heroMessage.uppercase && 'uppercase tracking-wide'
              )}
            >
              <p className="text-xs text-slate-500 mb-2">On-screen message</p>
              <p
                className={cn(
                  'text-2xl md:text-3xl leading-snug',
                  heroMessage.color === 'green' && 'text-green-400',
                  heroMessage.color === 'red' && 'text-red-400'
                )}
              >
                {heroText}
              </p>
            </div>
          ) : (
            <p className="text-slate-600 text-center lg:text-left">No visible message.</p>
          )}
        </section>
      </div>
    </div>
  )
}
