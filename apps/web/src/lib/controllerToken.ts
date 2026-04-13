import { CONTROLLER_TOKEN_HEADER } from '@cuepoint/shared'

const prefix = 'cuepoint:controllerToken:'

export function controllerTokenStorageKey(roomId: string) {
  return `${prefix}${roomId}`
}

/** Safely read from localStorage — returns null if storage is unavailable (e.g. Safari private). */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Safely write to localStorage — silently ignores errors (e.g. Safari private, quota exceeded). */
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — guest rooms will work but token won't persist across refreshes
  }
}

/** Safely remove from localStorage. */
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

export function setControllerToken(roomId: string, token: string) {
  safeSet(controllerTokenStorageKey(roomId), token)
}

export function getControllerToken(roomId: string) {
  return safeGet(controllerTokenStorageKey(roomId))
}

export function clearControllerToken(roomId: string) {
  safeRemove(controllerTokenStorageKey(roomId))
}

/** Merge into fetch `init` for timer/room mutations on guest-controlled rooms. */
export function roomControlInit(roomId: string): RequestInit {
  const t = getControllerToken(roomId)
  return t ? { headers: { [CONTROLLER_TOKEN_HEADER]: t } } : {}
}
