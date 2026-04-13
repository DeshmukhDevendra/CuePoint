/**
 * Collaborative cursors hook.
 * - Emits C2S.CURSOR_MOVE throttled to ~20fps
 * - Listens for S2C.CURSOR_MOVED and maintains a map of remote cursors
 * - Cursors expire after 5 seconds of inactivity
 */
import { useEffect, useRef, useCallback } from 'react'
import { create } from 'zustand'
import { C2S, S2C, type CursorMovedPayload } from '@cuepoint/shared'
import { getSocket, useSocketEvent } from './useSocket'

export interface RemoteCursor {
  userId: string
  name: string
  color: string
  x: number
  y: number
  over?: string
  updatedAt: number
}

interface CursorStore {
  cursors: Record<string, RemoteCursor>
  upsert: (cursor: RemoteCursor) => void
  remove: (userId: string) => void
  prune: () => void
}

const useCursorStore = create<CursorStore>((set) => ({
  cursors: {},
  upsert: (cursor) =>
    set((s) => ({ cursors: { ...s.cursors, [cursor.userId]: cursor } })),
  remove: (userId) =>
    set((s) => {
      const next = { ...s.cursors }
      delete next[userId]
      return { cursors: next }
    }),
  prune: () =>
    set((s) => {
      const cutoff = Date.now() - 5_000
      const next = { ...s.cursors }
      let changed = false
      for (const id of Object.keys(next)) {
        if (next[id]!.updatedAt < cutoff) {
          delete next[id]
          changed = true
        }
      }
      return changed ? { cursors: next } : s
    }),
}))

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899']

function colorForId(id: string): string {
  let n = 0
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i)
  return COLORS[n % COLORS.length]!
}

/** Emit cursor moves and receive remote cursors for a given room.
 *  Returns the cursors map (stable reference); call Object.values() in the component. */
export function useCursors(roomId: string | undefined, userId: string | undefined, name: string): Record<string, RemoteCursor> {
  const { upsert, prune } = useCursorStore()
  const lastEmit = useRef(0)

  // Receive remote cursors
  useSocketEvent<CursorMovedPayload>(S2C.CURSOR_MOVED, (payload) => {
    if (payload.roomId !== roomId) return
    upsert({
      userId: payload.userId,
      name: payload.name,
      color: payload.color,
      x: payload.x,
      y: payload.y,
      over: payload.over,
      updatedAt: Date.now(),
    })
  })

  // Prune stale cursors every 2s
  useEffect(() => {
    const t = setInterval(prune, 2_000)
    return () => clearInterval(t)
  }, [prune])

  // Emit own cursor moves (~20fps throttle)
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!roomId || !userId) return
      const now = Date.now()
      if (now - lastEmit.current < 50) return
      lastEmit.current = now
      const socket = getSocket()
      socket.emit(C2S.CURSOR_MOVE, {
        roomId,
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        userId,
        name: name || 'User',
        color: colorForId(userId),
      })
    },
    [roomId, userId, name]
  )

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [onMouseMove])

  // Return the cursors map (stable reference until changed) — component calls Object.values
  return useCursorStore((s) => s.cursors)
}
