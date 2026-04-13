import type { Request, Response, NextFunction } from 'express'
import { prisma } from '@cuepoint/db'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiRoom?: import('@cuepoint/db').Room
    }
  }
}

/**
 * Validates `Authorization: Bearer <room-api-key>`.
 * On success, attaches `req.apiRoom`. On failure returns 401.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_api_key' })
  }
  const key = auth.slice(7).trim()
  const room = await prisma.room.findFirst({
    where: { apiKey: key, deletedAt: null },
  })
  if (!room) return res.status(401).json({ error: 'invalid_api_key' })
  req.apiRoom = room
  return next()
}
