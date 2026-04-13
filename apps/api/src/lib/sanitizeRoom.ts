/**
 * Remove secrets before sending a room over Socket.IO or public HTTP.
 */
export function sanitizeRoomWire<R extends { apiKey?: string; anonymousControllerSecretHash?: string | null }>(
  room: R
): Omit<R, 'apiKey' | 'anonymousControllerSecretHash'> {
  const { apiKey: _a, anonymousControllerSecretHash: _h, ...rest } = room
  return rest
}
