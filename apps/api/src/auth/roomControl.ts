import type { Request } from 'express'
import { prisma } from '@cuepoint/db'
import { CONTROLLER_TOKEN_HEADER } from '@cuepoint/shared'
import { verifyPassword } from './password.js'
import type { Room } from '@cuepoint/db'

function readControllerToken(req: Request): string | undefined {
  const raw = req.get(CONTROLLER_TOKEN_HEADER)
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined
}

/**
 * Returns the room if the caller may mutate it: logged-in owner, or valid guest controller token.
 */
export async function assertRoomControl(req: Request, roomId: string): Promise<Room | null> {
  const room = await prisma.room.findFirst({
    where: { id: roomId, deletedAt: null },
  })
  if (!room) return null

  if (req.user && room.ownerId === req.user.id) return room

  if (room.ownerId) return null

  const token = readControllerToken(req)
  if (!room.anonymousControllerSecretHash || !token) return null

  try {
    const ok = await verifyPassword(room.anonymousControllerSecretHash, token)
    return ok ? room : null
  } catch {
    return null
  }
}
