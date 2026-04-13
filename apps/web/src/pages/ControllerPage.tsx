import { useState, useRef, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Timer } from '@cuepoint/db'
import { useRoom, useRoomStore, type RoomWithRelations } from '@/hooks/useRoom'
import { useTimerDisplay } from '@/hooks/useTimer'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAuth } from '@/stores/auth'
import { clearControllerToken, getControllerToken, roomControlInit } from '@/lib/controllerToken'
import { MessagesSection } from '@/components/MessagesSection'
import { OutputLinksSection } from '@/components/OutputLinksSection'
import { RoomLiveCard } from '@/components/RoomLiveCard'
import { SubmitQuestionSettings } from '@/components/SubmitQuestionSettings'
import { TimerEditDrawer } from '@/components/TimerEditDrawer'
import { LabelsSection } from '@/components/LabelsSection'
import { CSVImportExport } from '@/components/CSVImportExport'
import { CursorOverlay } from '@/components/CursorOverlay'
import { useCursors } from '@/hooks/useCursors'

function timerAction(roomId: string, timerId: string, action: string, adjustMs?: number) {
  return api.post(
    `/rooms/${roomId}/timers/${timerId}/action`,
    { action, adjustMs },
    roomControlInit(roomId)
  )
}

// ——— Mobile More Menu ———

function MoreMenu({ roomId, me }: { roomId: string; me: { id: string } | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const links = [
    { label: 'Viewer', href: `/rooms/${roomId}/viewer`, external: true },
    { label: 'Agenda', href: `/rooms/${roomId}/agenda`, external: true },
    { label: 'Moderator', href: `/rooms/${roomId}/moderator`, external: true },
    { label: 'Operator', href: `/rooms/${roomId}/operator`, external: true },
    { label: 'Submit Q', href: `/rooms/${roomId}/submit`, external: true },
    { label: 'Analytics', href: `/rooms/${roomId}/analytics`, external: false },
    { label: 'Logs', href: `/rooms/${roomId}/logs`, external: false },
  ]

  return (
    <div ref={ref} className="relative sm:hidden">
      <Button
        className="bg-muted text-foreground text-xs hover:opacity-80 h-9 px-3"
        onClick={() => setOpen((v) => !v)}
        aria-label="More options"
      >
        ⋯
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 min-w-[140px] rounded-lg border bg-card shadow-lg py-1">
          {links.map((l) => (
            <Link
              key={l.label}
              to={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noreferrer' : undefined}
              className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {me && (
            <Link
              to={`/rooms/${roomId}/settings`}
              className="block px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              ⚙ Settings
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ——— TimerRow ———

function TimerRow({
  timer,
  roomId,
  canMutate,
  onEdit,
}: {
  timer: Timer
  roomId: string
  canMutate: boolean
  onEdit: (timer: Timer) => void
}) {
  const { display, phase } = useTimerDisplay(timer, 0, {
    roomId,
    autoExpire: timer.triggerType === 'LINKED',
  })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: timer.id,
    disabled: !canMutate,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }

  const phaseColor = {
    normal: '',
    yellow: 'border-yellow-400',
    red: 'border-red-500',
    over: 'border-red-500 bg-red-500/10',
  }[phase]

  const isRunning = timer.isRunning
  const hasElapsed = timer.elapsedMs > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card px-3 py-3 transition-colors',
        phaseColor,
        isDragging && 'opacity-50'
      )}
    >
      {/* Top row: drag handle + title + time display */}
      <div className="flex items-center gap-2 mb-2">
        {canMutate ? (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground shrink-0 min-w-[24px] min-h-[44px] flex items-center justify-center"
            aria-label="Drag to reorder"
            type="button"
          >
            ⠿
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm sm:text-base">{timer.title ?? 'Untitled'}</p>
          {timer.speaker && (
            <p className="text-xs text-muted-foreground truncate">{timer.speaker}</p>
          )}
        </div>

        <span
          className={cn(
            'font-mono text-2xl font-bold tabular-nums shrink-0',
            phase === 'yellow' && 'text-yellow-500',
            (phase === 'red' || phase === 'over') && 'text-red-500'
          )}
        >
          {display}
        </span>

        {canMutate && (
          <Button
            className="h-9 w-9 px-0 bg-muted text-foreground hover:opacity-80 shrink-0"
            onClick={() => onEdit(timer)}
            aria-label="Edit timer"
          >
            ✏
          </Button>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex flex-wrap gap-1.5 pl-8">
        {/* Start / Pause — primary action, always prominent */}
        {!isRunning ? (
          <Button
            className="h-10 sm:h-8 px-3 text-sm sm:text-xs bg-green-600 hover:bg-green-700 min-w-[80px]"
            disabled={!canMutate}
            onClick={() => timerAction(roomId, timer.id, hasElapsed ? 'resume' : 'start')}
            title={hasElapsed ? 'Resume' : 'Start'}
          >
            <span className="sm:hidden">▶ {hasElapsed ? 'Resume' : 'Start'}</span>
            <span className="hidden sm:inline">▶ {hasElapsed ? 'Resume' : 'Start'}</span>
          </Button>
        ) : (
          <Button
            className="h-10 sm:h-8 px-3 text-sm sm:text-xs bg-yellow-500 hover:bg-yellow-600 text-black min-w-[80px]"
            disabled={!canMutate}
            onClick={() => timerAction(roomId, timer.id, 'pause')}
            title="Pause"
          >
            <span className="sm:hidden">⏸ Pause</span>
            <span className="hidden sm:inline">⏸ Pause</span>
          </Button>
        )}

        <Button
          className="h-10 sm:h-8 px-3 text-sm sm:text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'stop')}
          title="Stop"
        >
          <span className="sm:hidden">■</span>
          <span className="hidden sm:inline">■ Stop</span>
        </Button>

        <Button
          className="h-10 sm:h-8 px-3 text-sm sm:text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'reset')}
          title="Reset"
        >
          ↺
        </Button>

        <Button
          className="h-10 sm:h-8 px-2 text-sm sm:text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'adjust', 60_000)}
          title="Add 1 minute"
        >
          +1m
        </Button>

        <Button
          className="h-10 sm:h-8 px-2 text-sm sm:text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'adjust', -60_000)}
          title="Remove 1 minute"
        >
          -1m
        </Button>
      </div>
    </div>
  )
}

// ——— Mobile Bottom Bar ———

function MobileBottomBar({
  roomId,
  timers,
  canMutate,
}: {
  roomId: string
  timers: Timer[]
  canMutate: boolean
}) {
  const runningTimer = timers.find((t) => t.isRunning)
  const nextStopped = timers.find((t) => !t.isRunning)

  return (
    <div className="fixed bottom-0 inset-x-0 sm:hidden z-30 border-t bg-card/95 backdrop-blur px-4 py-2 flex gap-2">
      <Button
        className="flex-1 h-12 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40"
        disabled={!canMutate || !nextStopped}
        onClick={() => {
          if (!nextStopped) return
          void timerAction(roomId, nextStopped.id, nextStopped.elapsedMs > 0 ? 'resume' : 'start')
        }}
        title="Start next stopped timer"
      >
        ▶ Next
      </Button>

      <Button
        className="flex-1 h-12 text-sm bg-yellow-500 hover:bg-yellow-600 text-black disabled:opacity-40"
        disabled={!canMutate || !runningTimer}
        onClick={() => {
          if (!runningTimer) return
          void timerAction(roomId, runningTimer.id, 'pause')
        }}
        title="Pause running timer"
      >
        ⏸ Pause
      </Button>

      <Button
        className="flex-1 h-12 text-sm bg-muted text-foreground hover:opacity-80 disabled:opacity-40"
        disabled={!canMutate || !runningTimer}
        onClick={() => {
          if (!runningTimer) return
          void timerAction(roomId, runningTimer.id, 'stop')
        }}
        title="Stop running timer"
      >
        ■ Stop
      </Button>
    </div>
  )
}

// ——— ControllerPage ———

export function ControllerPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { me } = useAuth()
  const { room, loading, writeAccess } = useRoom(roomId!, 'controller')
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [editingTimer, setEditingTimer] = useState<Timer | null>(null)

  const cursorsMap = useCursors(roomId, me?.id, me?.name ?? me?.email ?? 'User')
  const remoteCursors = Object.values(cursorsMap)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const orderedTimers = localOrder
    ? (localOrder
        .map((id) => room?.timers.find((t) => t.id === id))
        .filter(Boolean) as Timer[])
    : (room?.timers ?? [])

  async function handleDragEnd(event: DragEndEvent) {
    if (!writeAccess) return
    const { active, over } = event
    if (!over || active.id === over.id || !room) return

    const oldIndex = orderedTimers.findIndex((t) => t.id === active.id)
    const newIndex = orderedTimers.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(orderedTimers, oldIndex, newIndex)
    setLocalOrder(reordered.map((t) => t.id))

    try {
      await api.put(
        `/rooms/${room.id}/timers/reorder`,
        { orderedIds: reordered.map((t) => t.id) },
        roomControlInit(room.id)
      )
    } finally {
      setLocalOrder(null)
    }
  }

  async function claimRoom() {
    if (!room || !roomId) return
    const token = getControllerToken(room.id)
    if (!token || !me) return
    setClaiming(true)
    try {
      const updated = await api.post<RoomWithRelations>(`/rooms/${room.id}/claim`, { controllerToken: token })
      clearControllerToken(room.id)
      useRoomStore.getState().setRoomBundle(updated, true)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }
  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-muted-foreground">
        <p>Room not found, or you do not have access.</p>
        <div className="flex gap-3">
          <Link to="/login">
            <Button className="bg-primary text-primary-foreground">Sign in</Button>
          </Link>
          {me && (
            <Link to="/">
              <Button className="bg-muted text-foreground">My rooms</Button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const canMutate = writeAccess
  const showClaim =
    Boolean(me) && !room.ownerId && Boolean(getControllerToken(room.id)) && writeAccess

  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b px-4 sm:px-6 py-3 gap-2">
        {/* Left: back + room title */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to={me ? '/' : '/login'} className="text-muted-foreground hover:text-foreground text-sm shrink-0">
            ←
          </Link>
          <span className="text-muted-foreground shrink-0">/</span>
          <h1 className="font-semibold truncate text-sm sm:text-base">{room.title}</h1>
          {room.onAir && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shrink-0">
              ON AIR
            </span>
          )}
        </div>

        {/* Right: desktop nav buttons + mobile ⋯ menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Desktop-only nav links */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Link to={`/rooms/${room.id}/viewer`} target="_blank" rel="noreferrer">
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Viewer</Button>
            </Link>
            <Link to={`/rooms/${room.id}/agenda`} target="_blank" rel="noreferrer">
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Agenda</Button>
            </Link>
            <Link to={`/rooms/${room.id}/moderator`} target="_blank" rel="noreferrer">
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Moderator</Button>
            </Link>
            <Link to={`/rooms/${room.id}/operator`} target="_blank" rel="noreferrer">
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Operator</Button>
            </Link>
            <Link to={`/rooms/${room.id}/submit`} target="_blank" rel="noreferrer">
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Submit Q</Button>
            </Link>
            <Link to={`/rooms/${room.id}/analytics`}>
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Analytics</Button>
            </Link>
            <Link to={`/rooms/${room.id}/logs`}>
              <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">Logs</Button>
            </Link>
            {me && (
              <Link to={`/rooms/${room.id}/settings`}>
                <Button className="bg-muted text-foreground text-xs hover:opacity-80 h-8 px-3">⚙ Settings</Button>
              </Link>
            )}
          </div>

          {/* Mobile ⋯ dropdown */}
          <MoreMenu roomId={room.id} me={me} />

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-4 sm:py-6 space-y-3">
        {!room.ownerId && (
          <Card className="border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Guest room — keep this browser profile, or save the link.
          </Card>
        )}

        {showClaim && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 px-4 py-3">
            <p className="text-sm">Save this guest room to your account.</p>
            <Button disabled={claiming} onClick={() => void claimRoom()} className="h-10 min-w-[140px]">
              {claiming ? 'Saving…' : 'Save to my account'}
            </Button>
          </Card>
        )}

        {!writeAccess && (
          <Card className="border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            Read-only: open this page from the device that created the guest room, or sign in as the room owner.
          </Card>
        )}

        <RoomLiveCard roomId={room.id} room={room} canMutate={canMutate} />

        {orderedTimers.length === 0 && (
          <Card className="text-center text-muted-foreground py-10">
            No timers yet.{' '}
            {canMutate ? (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() =>
                  void api.post(
                    `/rooms/${room.id}/timers`,
                    { durationMs: 5 * 60 * 1000, title: 'New Timer' },
                    roomControlInit(room.id)
                  )
                }
              >
                Add one
              </button>
            ) : (
              <span>Sign in or use the guest link from the room creator to add timers.</span>
            )}
          </Card>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedTimers.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {orderedTimers.map((timer) => (
              <TimerRow key={timer.id} timer={timer} roomId={room.id} canMutate={canMutate} onEdit={setEditingTimer} />
            ))}
          </SortableContext>
        </DndContext>

        <Button
          className="w-full h-11 sm:h-10 bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() =>
            void api.post(
              `/rooms/${room.id}/timers`,
              { durationMs: 5 * 60 * 1000, title: 'New Timer' },
              roomControlInit(room.id)
            )
          }
        >
          + Add Timer
        </Button>

        <LabelsSection roomId={room.id} labels={room.labels} />

        <CSVImportExport roomId={room.id} timers={orderedTimers} roomTitle={room.title} />

        <MessagesSection roomId={room.id} messages={room.messages} canMutate={canMutate} />

        <SubmitQuestionSettings roomId={room.id} submitConfig={room.submitConfig} canMutate={canMutate} />

        <OutputLinksSection roomId={room.id} canMutate={canMutate} />
      </main>

      {/* ── Timer edit drawer ── */}
      {editingTimer && (
        <TimerEditDrawer
          timer={editingTimer}
          roomId={room.id}
          labels={room.labels}
          onClose={() => setEditingTimer(null)}
          onSaved={() => setEditingTimer(null)}
        />
      )}

      {/* ── Mobile bottom bar ── */}
      {canMutate && orderedTimers.length > 0 && (
        <MobileBottomBar roomId={room.id} timers={orderedTimers} canMutate={canMutate} />
      )}

      <CursorOverlay cursors={remoteCursors} />
    </div>
  )
}
