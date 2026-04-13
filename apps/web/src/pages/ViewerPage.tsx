import { useEffect, useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useRoom, useRoomStore, type RoomWithRelations } from '@/hooks/useRoom'
import { useTimerDisplay } from '@/hooks/useTimer'
import type { Timer } from '@cuepoint/db'
import { applyPlaceholders, type ParsedOutputLinkOptions } from '@cuepoint/shared'
import { cn } from '@/lib/cn'

function ActiveTimerDisplay({
  timer,
  roomTitle,
  streamDelaySec = 0,
}: {
  timer: Timer
  roomTitle: string
  streamDelaySec?: number
}) {
  const { display, phase } = useTimerDisplay(timer, streamDelaySec, { viewerMode: true })
  const wrapFlash = Boolean(timer.wrapupFlash && (phase === 'red' || phase === 'over'))
  const title = applyPlaceholders(timer.title ?? '', {
    roomTitle,
    timerTitle: timer.title ?? undefined,
    speaker: timer.speaker ?? undefined,
  })
  const speaker = timer.speaker
    ? applyPlaceholders(timer.speaker, {
        roomTitle,
        timerTitle: timer.title ?? undefined,
        speaker: timer.speaker ?? undefined,
      })
    : ''

  const bgColor = {
    normal: 'bg-black text-white',
    yellow: 'bg-black text-yellow-400',
    red: 'bg-black text-red-500',
    over: 'bg-red-900 text-red-200',
  }[phase]

  return (
    <div className={cn('relative flex flex-col items-center justify-center h-full gap-6 transition-colors', bgColor)}>
      {wrapFlash && (
        <div
          className="pointer-events-none absolute inset-0 z-10 ring-[6px] ring-white/50 animate-pulse"
          aria-hidden
        />
      )}
      {title && (
        <p className="text-2xl font-medium tracking-wide opacity-60 uppercase">{title}</p>
      )}
      <div
        className={cn(
          'font-mono font-black tabular-nums leading-none select-none',
          'text-[20vw]',
          phase === 'over' && 'animate-pulse'
        )}
      >
        {display}
      </div>
      {speaker && <p className="text-xl opacity-50">{speaker}</p>}
    </div>
  )
}

function IdleDisplay() {
  return (
    <div className="flex h-full items-center justify-center bg-black text-white opacity-30">
      <p className="text-4xl font-mono">--:--</p>
    </div>
  )
}

/** Shared chrome for full-screen viewer surfaces (classic or custom layout). */
export type ViewerBlackoutMode = 'fullscreen' | 'dim' | 'none'

export function ViewerShell({
  room,
  linkOptions,
  liveConnectionCount,
  mirror,
  hideChrome,
  blackoutMode = 'fullscreen',
  children,
  footer,
}: {
  room: RoomWithRelations
  linkOptions?: ParsedOutputLinkOptions
  liveConnectionCount?: number | null
  mirror: boolean
  hideChrome: boolean
  /** CUSTOM layouts: how room blackout is shown (`none` = keep canvas visible). */
  blackoutMode?: ViewerBlackoutMode
  children: ReactNode
  footer?: ReactNode
}) {
  const blackout =
    room.blackout &&
    (blackoutMode === 'dim' ? (
      <div className="pointer-events-none absolute inset-0 z-20 bg-black/55" aria-hidden />
    ) : blackoutMode === 'fullscreen' ? (
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/93 text-center text-white/35 text-sm font-medium uppercase tracking-[0.35em]">
        Stand by
      </div>
    ) : null)

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col bg-black">
      {!hideChrome && linkOptions?.identifier && (
        <p className="pointer-events-none absolute top-3 left-3 z-30 max-w-[70vw] truncate text-xs text-white/55 font-mono">
          {linkOptions.identifier}
        </p>
      )}
      {!hideChrome && linkOptions?.timezone && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-30 text-[10px] text-white/40 font-mono">
          TZ {linkOptions.timezone}
        </p>
      )}
      {!hideChrome && room.onAir && (
        <div className="pointer-events-none absolute top-4 right-4 z-30 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
          On air
        </div>
      )}
      {!hideChrome && liveConnectionCount != null && liveConnectionCount >= 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-md bg-black/60 px-2 py-1 text-[11px] font-mono text-white/70">
          Live: {liveConnectionCount}
        </div>
      )}
      {blackout}
      <div className={cn('flex flex-1 min-h-0 flex-col', mirror && 'scale-x-[-1]')}>
        {children}
        {footer}
      </div>
    </div>
  )
}

export function ViewerLayout({
  room,
  linkOptions,
  liveConnectionCount,
}: {
  room: RoomWithRelations
  linkOptions?: ParsedOutputLinkOptions
  liveConnectionCount?: number | null
}) {
  const activeTimer = room.timers.find((t) => t.isRunning) ?? room.timers[0] ?? null
  const hideChrome = linkOptions?.hideControls === true
  const mirror = linkOptions?.mirror === true
  const delaySec = linkOptions?.delaySec ?? 0

  const banner = useMemo(() => {
    const visible = room.messages.filter((m) => m.visible)
    const m = visible.find((x) => x.focus) ?? visible[0]
    if (!m) return null
    const text = applyPlaceholders(m.text, {
      roomTitle: room.title,
      timerTitle: activeTimer?.title ?? undefined,
      speaker: activeTimer?.speaker ?? undefined,
    })
    return { msg: m, text }
  }, [room, activeTimer])

  const footer =
    !hideChrome && banner ? (
      <div
        className={cn(
          'shrink-0 border-t border-white/10 px-6 py-4 text-center text-white bg-zinc-900/95',
          banner.msg.flash && 'animate-pulse',
          banner.msg.bold && 'font-bold',
          banner.msg.uppercase && 'uppercase tracking-wide',
          banner.msg.color === 'green' && 'text-green-400',
          banner.msg.color === 'red' && 'text-red-400'
        )}
      >
        <p className={cn('text-lg md:text-2xl leading-snug', !banner.msg.color && 'text-white')}>{banner.text}</p>
      </div>
    ) : undefined

  return (
    <ViewerShell
      room={room}
      linkOptions={linkOptions}
      liveConnectionCount={liveConnectionCount}
      mirror={mirror}
      hideChrome={hideChrome}
      footer={footer}
    >
      <div className="flex-1 min-h-0">
        {activeTimer ? (
          <ActiveTimerDisplay timer={activeTimer} roomTitle={room.title} streamDelaySec={delaySec} />
        ) : (
          <IdleDisplay />
        )}
      </div>
    </ViewerShell>
  )
}

export function ViewerPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { room, loading, fetchError } = useRoom(roomId!, 'viewer', { publicFor: 'viewer' })
  const liveConnectionCount = useRoomStore((s) => s.liveConnectionCount)

  useEffect(() => {
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  if (fetchError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-lg max-w-md">{fetchError}</p>
        <p className="text-sm text-white/50">Use an output link from the room controller, or ask the operator to open access.</p>
      </div>
    )
  }

  if (loading || !room) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white text-2xl">
        {loading ? 'Connecting…' : 'Unavailable.'}
      </div>
    )
  }

  return <ViewerLayout room={room} liveConnectionCount={liveConnectionCount} />
}
