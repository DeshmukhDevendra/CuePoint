import { useState } from 'react'
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors',
        phaseColor,
        isDragging && 'opacity-50'
      )}
    >
      {canMutate ? (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground"
          aria-label="Drag"
          type="button"
        >
          ⠿
        </button>
      ) : (
        <span className="w-6" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{timer.title ?? 'Untitled'}</p>
        {timer.speaker && <p className="text-xs text-muted-foreground truncate">{timer.speaker}</p>}
      </div>

      <span
        className={cn(
          'font-mono text-2xl font-bold tabular-nums w-24 text-right',
          phase === 'yellow' && 'text-yellow-500',
          phase === 'red' && 'text-red-500',
          phase === 'over' && 'text-red-500'
        )}
      >
        {display}
      </span>

      <div className="flex gap-1">
        {canMutate && (
          <Button
            className="h-8 px-2 text-xs bg-muted text-foreground hover:opacity-80"
            onClick={() => onEdit(timer)}
            aria-label="Edit timer"
          >
            ✏
          </Button>
        )}
        {!timer.isRunning ? (
          <Button
            className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
            disabled={!canMutate}
            onClick={() => timerAction(roomId, timer.id, timer.elapsedMs > 0 ? 'resume' : 'start')}
          >
            {timer.elapsedMs > 0 ? '▶ Resume' : '▶ Start'}
          </Button>
        ) : (
          <Button
            className="h-8 px-3 text-xs bg-yellow-500 hover:bg-yellow-600 text-black"
            disabled={!canMutate}
            onClick={() => timerAction(roomId, timer.id, 'pause')}
          >
            ⏸ Pause
          </Button>
        )}
        <Button
          className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'stop')}
        >
          ■ Stop
        </Button>
        <Button
          className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'reset')}
        >
          ↺
        </Button>
        <Button
          className="h-8 px-2 text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'adjust', 60_000)}
        >
          -1m
        </Button>
        <Button
          className="h-8 px-2 text-xs bg-muted text-foreground hover:opacity-80"
          disabled={!canMutate}
          onClick={() => timerAction(roomId, timer.id, 'adjust', -60_000)}
        >
          +1m
        </Button>
      </div>
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
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to={me ? '/' : '/login'} className="text-muted-foreground hover:text-foreground text-sm">
            ← {me ? 'Rooms' : 'Sign in'}
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold truncate max-w-xs">{room.title}</h1>
          {room.onAir && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">ON AIR</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to={`/rooms/${room.id}/viewer`} target="_blank" rel="noreferrer">
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Viewer</Button>
          </Link>
          <Link to={`/rooms/${room.id}/agenda`} target="_blank" rel="noreferrer">
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Agenda</Button>
          </Link>
          <Link to={`/rooms/${room.id}/moderator`} target="_blank" rel="noreferrer">
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Moderator</Button>
          </Link>
          <Link to={`/rooms/${room.id}/operator`} target="_blank" rel="noreferrer">
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Operator</Button>
          </Link>
          <Link to={`/rooms/${room.id}/submit`} target="_blank" rel="noreferrer">
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Submit Q</Button>
          </Link>
          <Link to={`/rooms/${room.id}/logs`}>
            <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Logs</Button>
          </Link>
          {me && (
            <Link to={`/rooms/${room.id}/settings`}>
              <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">⚙ Settings</Button>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 space-y-3">
        {!room.ownerId && (
          <Card className="border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Guest room — keep this browser profile, or save the link. Clear site data and you will lose control
            unless you sign in and save the room to your account.
          </Card>
        )}

        {showClaim && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 px-4 py-3">
            <p className="text-sm">Save this guest room to your account so it appears in your room list.</p>
            <Button disabled={claiming} onClick={() => void claimRoom()}>
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
          className="w-full bg-muted text-foreground hover:opacity-80"
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

      {editingTimer && (
        <TimerEditDrawer
          timer={editingTimer}
          roomId={room.id}
          labels={room.labels}
          onClose={() => setEditingTimer(null)}
          onSaved={() => setEditingTimer(null)}
        />
      )}

      <CursorOverlay cursors={remoteCursors} />
    </div>
  )
}
