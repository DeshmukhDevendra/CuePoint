import { useState, type FormEvent } from 'react'
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
import type { Message } from '@cuepoint/db'
import { Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { roomControlInit } from '@/lib/controllerToken'

const COLORS = ['white', 'green', 'red'] as const

function MessageRow({
  message,
  roomId,
  canMutate,
  onActionError,
}: {
  message: Message
  roomId: string
  canMutate: boolean
  onActionError: (text: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: message.id,
    disabled: !canMutate,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const pendingAudience = message.source === 'AUDIENCE' && !message.visible

  async function patch(partial: Record<string, unknown>) {
    if (!canMutate) return
    onActionError(null)
    try {
      await api.patch(`/rooms/${roomId}/messages/${message.id}`, partial, roomControlInit(roomId))
    } catch {
      onActionError('Could not update message.')
    }
  }

  async function onDelete() {
    if (!canMutate) return
    onActionError(null)
    try {
      await api.delete(`/rooms/${roomId}/messages/${message.id}`, roomControlInit(roomId))
    } catch {
      onActionError('Could not delete message.')
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card p-3 space-y-2',
        message.visible && 'ring-2 ring-primary/60',
        pendingAudience && 'border-amber-500/50 bg-amber-500/5',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex gap-2 items-start">
        {canMutate ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground shrink-0 pt-1"
            aria-label="Drag message"
          >
            ⠿
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {message.source === 'AUDIENCE' && (
            <span className="mb-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground">
              Audience
            </span>
          )}
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
          {message.authorName && (
            <p className="text-xs text-muted-foreground mt-1">— {message.authorName}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0 items-end">
          {pendingAudience && canMutate && (
            <Button type="button" className="h-8 text-xs px-2" onClick={() => void patch({ visible: true })}>
              Show on screen
            </Button>
          )}
          <Button
            type="button"
            className="h-8 shrink-0 bg-destructive/80 text-destructive-foreground hover:opacity-90 text-xs px-2"
            disabled={!canMutate}
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-center pl-8">
        <span className="text-xs text-muted-foreground">Color</span>
        <select
          className="h-8 rounded border bg-background text-xs px-2"
          disabled={!canMutate}
          value={message.color}
          onChange={(e) => void patch({ color: e.target.value })}
        >
          {COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={!canMutate}
            checked={message.visible}
            onChange={(e) => void patch({ visible: e.target.checked })}
          />
          Visible
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={!canMutate}
            checked={message.flash}
            onChange={(e) => void patch({ flash: e.target.checked })}
          />
          Flash
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={!canMutate}
            checked={message.focus}
            onChange={(e) => void patch({ focus: e.target.checked })}
          />
          Focus
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={!canMutate}
            checked={message.bold}
            onChange={(e) => void patch({ bold: e.target.checked })}
          />
          Bold
        </label>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            disabled={!canMutate}
            checked={message.uppercase}
            onChange={(e) => void patch({ uppercase: e.target.checked })}
          />
          ALL CAPS
        </label>
      </div>
    </div>
  )
}

export function MessagesSection({
  roomId,
  messages,
  canMutate,
}: {
  roomId: string
  messages: Message[]
  canMutate: boolean
}) {
  const [draft, setDraft] = useState('')
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const ordered = localOrder
    ? (localOrder
        .map((id) => messages.find((m) => m.id === id))
        .filter(Boolean) as Message[])
    : messages

  async function onDragEnd(event: DragEndEvent) {
    if (!canMutate) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ordered.findIndex((m) => m.id === active.id)
    const newIndex = ordered.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(ordered, oldIndex, newIndex)
    setLocalOrder(reordered.map((m) => m.id))
    setActionError(null)
    try {
      await api.put(
        `/rooms/${roomId}/messages/reorder`,
        { orderedIds: reordered.map((m) => m.id) },
        roomControlInit(roomId)
      )
    } catch {
      setActionError('Could not reorder messages.')
    } finally {
      setLocalOrder(null)
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setActionError(null)
    try {
      await api.post(`/rooms/${roomId}/messages`, { text }, roomControlInit(roomId))
      setDraft('')
    } catch {
      setActionError('Could not add message.')
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Messages</h2>
        <p className="text-xs text-muted-foreground">
          Use <code className="text-[11px]">{'{{room}}'}</code>, <code className="text-[11px]">{'{{timer}}'}</code>,{' '}
          <code className="text-[11px]">{'{{speaker}}'}</code> in text for live placeholders on outputs.
        </p>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      <form onSubmit={onAdd} className="flex gap-2">
        <Input
          placeholder="New message…"
          value={draft}
          disabled={!canMutate}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={!canMutate}>
          Add
        </Button>
      </form>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ordered.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ordered.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  roomId={roomId}
                  canMutate={canMutate}
                  onActionError={setActionError}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  )
}
