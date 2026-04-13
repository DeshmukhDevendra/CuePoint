/**
 * Realtime Socket.IO event names & payload shapes, shared by server + clients.
 * Keep this file small — just the wire contract, no logic.
 */

// ============================================================
// Client → Server
// ============================================================

export const C2S = {
  JOIN_ROOM: 'c2s:join_room',
  LEAVE_ROOM: 'c2s:leave_room',
  TIMER_ACTION: 'c2s:timer_action',
  MESSAGE_UPDATE: 'c2s:message_update',
  ROOM_UPDATE: 'c2s:room_update',
  CURSOR_MOVE: 'c2s:cursor_move', // collaborative cursors (enhancement)
  PING: 'c2s:ping',
} as const

// ============================================================
// Server → Client
// ============================================================

export const S2C = {
  ROOM_STATE: 's2c:room_state', // full snapshot on join
  ROOM_UPDATED: 's2c:room_updated',
  ROOM_FIELDS_UPDATED: 's2c:room_fields_updated',
  LIVE_CONNECTIONS: 's2c:live_connections',
  TIMER_UPDATED: 's2c:timer_updated',
  TIMER_LIST_UPDATED: 's2c:timer_list_updated', // reorder / add / delete
  MESSAGE_UPDATED: 's2c:message_updated',
  MESSAGE_LIST_UPDATED: 's2c:message_list_updated',
  SUBMIT_CONFIG_UPDATED: 's2c:submit_config_updated',
  CURSOR_MOVED: 's2c:cursor_moved',
  PONG: 's2c:pong', // carries serverNow for clock offset calc
  ERROR: 's2c:error',
} as const

// ============================================================
// Payloads
// ============================================================

export interface JoinRoomPayload {
  roomId: string
  /** HMAC-signed output link signature for public viewers */
  signature?: string
}

export interface PingPayload {
  clientSentAt: number
}

export interface PongPayload {
  clientSentAt: number
  serverNow: number
}

export interface CursorMovePayload {
  roomId: string
  x: number
  y: number
  /** optional element id the cursor is hovering */
  over?: string
}

export interface CursorMovedPayload extends CursorMovePayload {
  userId: string
  name: string
  color: string
}

export interface ErrorPayload {
  code: string
  message: string
}
