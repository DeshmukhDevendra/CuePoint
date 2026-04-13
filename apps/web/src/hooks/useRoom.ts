import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { Room, Timer, Message, Label, SubmitQuestionConfig } from '@cuepoint/db'
import {
  CONTROLLER_TOKEN_HEADER,
  parseOutputLinkOptions,
  S2C,
  type ParsedOutputLinkOptions,
  type PublicRoomForQuery,
} from '@cuepoint/shared'
import { joinRoom, leaveRoom, useSocketEvent } from './useSocket'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { getControllerToken } from '@/lib/controllerToken'

export type RoomWithRelations = Room & {
  timers: Timer[]
  messages: Message[]
  labels: Label[]
  submitConfig: SubmitQuestionConfig | null
}

type PublicRoomResponse = RoomWithRelations & { writeAccess: boolean }

export type RoomAccessMode = 'controller' | 'viewer'

interface RoomState {
  room: RoomWithRelations | null
  writeAccess: boolean
  loading: boolean
  setRoomBundle: (room: RoomWithRelations | null, writeAccess: boolean) => void
  setLoading: (v: boolean) => void
  hydrateFromSocket: (room: RoomWithRelations) => void
  upsertTimer: (t: Timer) => void
  removeTimer: (id: string) => void
  setTimers: (ts: Timer[]) => void
  upsertMessage: (m: Message) => void
  removeMessage: (id: string) => void
  setMessages: (ms: Message[]) => void
  setSubmitConfig: (submitConfig: SubmitQuestionConfig | null) => void
  patchRoomFields: (partial: { onAir?: boolean; blackout?: boolean; settings?: unknown }) => void
  liveConnectionCount: number | null
  setLiveConnectionCount: (n: number | null) => void
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  writeAccess: false,
  loading: false,
  liveConnectionCount: null,
  setRoomBundle: (room, writeAccess) =>
    set((s) => {
      const prevId = s.room?.id
      const nextId = room?.id
      const sameRoom = prevId === nextId
      return {
        room,
        writeAccess,
        liveConnectionCount: room === null ? null : sameRoom ? s.liveConnectionCount : null,
      }
    }),
  setLoading: (loading) => set({ loading }),
  hydrateFromSocket: (room) =>
    set((s) => ({
      room,
      writeAccess: s.writeAccess,
    })),
  upsertTimer: (timer) =>
    set((s) => {
      if (!s.room) return s
      const exists = s.room.timers.find((t) => t.id === timer.id)
      const timers = exists
        ? s.room.timers.map((t) => (t.id === timer.id ? timer : t))
        : [...s.room.timers, timer].sort((a, b) => a.order - b.order)
      return { room: { ...s.room, timers }, writeAccess: s.writeAccess }
    }),
  removeTimer: (id) =>
    set((s) => {
      if (!s.room) return s
      return { room: { ...s.room, timers: s.room.timers.filter((t) => t.id !== id) }, writeAccess: s.writeAccess }
    }),
  setTimers: (timers) =>
    set((s) => {
      if (!s.room) return s
      return { room: { ...s.room, timers }, writeAccess: s.writeAccess }
    }),
  upsertMessage: (message) =>
    set((s) => {
      if (!s.room) return s
      const exists = s.room.messages.find((m) => m.id === message.id)
      const messages = exists
        ? s.room.messages.map((m) => (m.id === message.id ? message : m))
        : [...s.room.messages, message].sort((a, b) => a.order - b.order)
      return { room: { ...s.room, messages }, writeAccess: s.writeAccess }
    }),
  removeMessage: (id) =>
    set((s) => {
      if (!s.room) return s
      return {
        room: { ...s.room, messages: s.room.messages.filter((m) => m.id !== id) },
        writeAccess: s.writeAccess,
      }
    }),
  setMessages: (messages) =>
    set((s) => {
      if (!s.room) return s
      return { room: { ...s.room, messages }, writeAccess: s.writeAccess }
    }),
  setSubmitConfig: (submitConfig) =>
    set((s) => {
      if (!s.room) return s
      return { room: { ...s.room, submitConfig }, writeAccess: s.writeAccess }
    }),
  patchRoomFields: (partial) =>
    set((s) => {
      if (!s.room) return s
      return {
        room: {
          ...s.room,
          onAir: partial.onAir ?? s.room.onAir,
          blackout: partial.blackout ?? s.room.blackout,
          settings:
            partial.settings !== undefined ? partial.settings : s.room.settings,
        },
        writeAccess: s.writeAccess,
      }
    }),
  setLiveConnectionCount: (liveConnectionCount) => set({ liveConnectionCount }),
}))

/** Socket.IO room state + timer/message/submit-config events (controller, viewer, output-link viewer). */
export function useRoomRealtimeSubscriptions() {
  const {
    hydrateFromSocket,
    upsertTimer,
    removeTimer,
    setTimers,
    upsertMessage,
    removeMessage,
    setMessages,
    setSubmitConfig,
    patchRoomFields,
    setLiveConnectionCount,
  } = useRoomStore()

  useSocketEvent<RoomWithRelations>(S2C.ROOM_STATE, hydrateFromSocket)
  useSocketEvent<Timer>(S2C.TIMER_UPDATED, upsertTimer)
  useSocketEvent<{ type: string; timer?: Timer; timerId?: string; timers?: Timer[] }>(
    S2C.TIMER_LIST_UPDATED,
    (payload) => {
      if (payload.type === 'created' && payload.timer) upsertTimer(payload.timer)
      else if (payload.type === 'deleted' && payload.timerId) removeTimer(payload.timerId)
      else if (payload.type === 'reordered' && payload.timers) setTimers(payload.timers)
    }
  )

  useSocketEvent<Message>(S2C.MESSAGE_UPDATED, upsertMessage)
  useSocketEvent<{ type: string; message?: Message; messageId?: string; messages?: Message[] }>(
    S2C.MESSAGE_LIST_UPDATED,
    (payload) => {
      if (payload.type === 'created' && payload.message) upsertMessage(payload.message)
      else if (payload.type === 'deleted' && payload.messageId) removeMessage(payload.messageId)
      else if (payload.type === 'reordered' && payload.messages) setMessages(payload.messages)
    }
  )

  useSocketEvent<{ submitConfig: SubmitQuestionConfig }>(S2C.SUBMIT_CONFIG_UPDATED, (payload) => {
    setSubmitConfig(payload.submitConfig)
  })

  useSocketEvent<{ onAir?: boolean; blackout?: boolean; settings?: unknown }>(
    S2C.ROOM_FIELDS_UPDATED,
    (payload) => {
      patchRoomFields(payload)
    }
  )

  useSocketEvent<{ count: number }>(S2C.LIVE_CONNECTIONS, (payload) => {
    setLiveConnectionCount(typeof payload.count === 'number' ? payload.count : null)
  })
}

export function useRoom(
  roomId: string,
  mode: RoomAccessMode = 'controller',
  opts?: { publicFor?: PublicRoomForQuery }
) {
  const { me, loaded: authLoaded } = useAuth()
  const { room, loading, writeAccess, setRoomBundle, setLoading } = useRoomStore()
  const [fetchError, setFetchError] = useState<string | null>(null)

  useRoomRealtimeSubscriptions()

  const publicFor = mode === 'viewer' ? (opts?.publicFor ?? 'viewer') : undefined

  /* eslint-disable react-hooks/exhaustive-deps -- Zustand setters are stable; `me?.id` scopes refetch to auth identity. */
  useEffect(() => {
    if (!authLoaded && mode === 'controller') {
      setLoading(true)
      return
    }

    let cancelled = false
    setLoading(true)
    setRoomBundle(null, false)
    setFetchError(null)

    ;(async () => {
      try {
        if (mode === 'viewer' && publicFor) {
          const data = await api.get<PublicRoomResponse>(`/public/rooms/${roomId}?for=${publicFor}`)
          const { writeAccess: wa, ...rest } = data
          if (!cancelled) setRoomBundle(rest as RoomWithRelations, wa)
          return
        }

        if (me) {
          try {
            const owned = await api.get<RoomWithRelations>(`/rooms/${roomId}`)
            if (!cancelled) setRoomBundle(owned, true)
            return
          } catch (e) {
            if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 404)) throw e
          }
        }

        const token = getControllerToken(roomId)
        const headers = token ? { [CONTROLLER_TOKEN_HEADER]: token } : undefined
        const data = await api.get<PublicRoomResponse>(`/public/rooms/${roomId}`, { headers })
        const { writeAccess: wa, ...rest } = data
        if (!cancelled) setRoomBundle(rest as RoomWithRelations, Boolean(wa))
      } catch (e) {
        if (!cancelled) {
          setRoomBundle(null, false)
          if (e instanceof ApiError && e.code === 'viewer_requires_output_link') {
            setFetchError('This room only accepts the shared output link for the main viewer.')
          } else if (mode === 'viewer') {
            setFetchError('Could not load this room.')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [roomId, mode, authLoaded, me?.id, publicFor])
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    joinRoom(roomId)
    return () => {
      leaveRoom(roomId)
    }
  }, [roomId])

  return { room, loading, writeAccess, fetchError }
}

export type OutputLinkResolveOutput = {
  id: string
  name: string
  type: string
  layout: unknown
  logoUrl?: string | null
  logoMode?: string | null
}

type OutputLinkResolveResponse = {
  room: RoomWithRelations
  options: Record<string, unknown>
  joinSignature: string
  shortCode?: string | null
  output?: OutputLinkResolveOutput
}

/** Hydrate from a signed output link (Phase 3); joins Socket.IO with signature validation. */
export function useOutputLinkViewer(params: { signature?: string; shortCode?: string }) {
  const { signature, shortCode } = params
  const { room, loading, setRoomBundle, setLoading } = useRoomStore()
  const joinedIdRef = useRef<string | null>(null)
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [linkOptions, setLinkOptions] = useState<ParsedOutputLinkOptions>({})
  const [outputMeta, setOutputMeta] = useState<OutputLinkResolveOutput | null>(null)
  const [unlockNonce, setUnlockNonce] = useState(0)
  useRoomRealtimeSubscriptions()

  useEffect(() => {
    if (!signature && !shortCode) {
      setRoomBundle(null, false)
      setLoading(false)
      setPasswordRequired(false)
      setLinkOptions({})
      setOutputMeta(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setRoomBundle(null, false)
    setPasswordRequired(false)
    setOutputMeta(null)

    ;(async () => {
      try {
        const path = shortCode
          ? `/public/output-links/short/${encodeURIComponent(shortCode)}`
          : `/public/output-links/${encodeURIComponent(signature!)}`
        const data = await api.get<OutputLinkResolveResponse>(path)
        if (cancelled) return
        setRoomBundle(data.room, false)
        setLinkOptions(parseOutputLinkOptions(data.options))
        setOutputMeta(data.output ?? null)
        joinRoom(data.room.id, data.joinSignature)
        joinedIdRef.current = data.room.id
      } catch (e) {
        if (!cancelled) {
          setRoomBundle(null, false)
          setOutputMeta(null)
          if (e instanceof ApiError && e.code === 'output_password_required') {
            setPasswordRequired(true)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (joinedIdRef.current) {
        leaveRoom(joinedIdRef.current)
        joinedIdRef.current = null
      }
    }
  }, [signature, shortCode, unlockNonce, setRoomBundle, setLoading])

  const retryAfterUnlock = () => setUnlockNonce((n) => n + 1)

  return { room, loading, passwordRequired, linkOptions, outputMeta, retryAfterUnlock }
}
