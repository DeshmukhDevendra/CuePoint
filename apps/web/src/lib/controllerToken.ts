import { CONTROLLER_TOKEN_HEADER } from '@cuepoint/shared'

const prefix = 'cuepoint:controllerToken:'

export function controllerTokenStorageKey(roomId: string) {
  return `${prefix}${roomId}`
}

export function setControllerToken(roomId: string, token: string) {
  localStorage.setItem(controllerTokenStorageKey(roomId), token)
}

export function getControllerToken(roomId: string) {
  return localStorage.getItem(controllerTokenStorageKey(roomId))
}

export function clearControllerToken(roomId: string) {
  localStorage.removeItem(controllerTokenStorageKey(roomId))
}

/** Merge into fetch `init` for timer/room mutations on guest-controlled rooms. */
export function roomControlInit(roomId: string): RequestInit {
  const t = getControllerToken(roomId)
  return t ? { headers: { [CONTROLLER_TOKEN_HEADER]: t } } : {}
}
