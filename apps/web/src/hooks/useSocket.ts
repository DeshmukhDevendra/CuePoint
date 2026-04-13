import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { C2S, S2C, type JoinRoomPayload, type PongPayload } from '@cuepoint/shared'

let socket: Socket | null = null
let clockOffsetMs = 0

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', withCredentials: true })

    // Clock offset handshake — run once on connect
    socket.on('connect', () => {
      const sent = Date.now()
      socket!.emit(C2S.PING, { clientSentAt: sent })
    })
    socket.on(S2C.PONG, (p: PongPayload) => {
      const rtt = Date.now() - p.clientSentAt
      clockOffsetMs = p.serverNow - p.clientSentAt - rtt / 2
    })
  }
  return socket
}

export function getClockOffset() {
  return clockOffsetMs
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const sock = getSocket()
    const fn = (data: T) => handlerRef.current(data)
    sock.on(event, fn)
    return () => { sock.off(event, fn) }
  }, [event])
}

export function joinRoom(roomId: string, signature?: string) {
  const payload: JoinRoomPayload = { roomId }
  if (signature) payload.signature = signature
  getSocket().emit(C2S.JOIN_ROOM, payload)
}

export function leaveRoom(roomId: string) {
  getSocket().emit(C2S.LEAVE_ROOM, { roomId })
}
