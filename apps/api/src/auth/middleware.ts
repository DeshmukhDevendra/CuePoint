import type { Request, Response, NextFunction } from 'express'
import type { Session, User } from 'lucia'
import { lucia } from './lucia.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User | null
      session: Session | null
    }
  }
}

export async function attachSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? '')
  if (!sessionId) {
    req.user = null
    req.session = null
    return next()
  }

  const { session, user } = await lucia.validateSession(sessionId)

  if (session && session.fresh) {
    const cookie = lucia.createSessionCookie(session.id)
    res.appendHeader('Set-Cookie', cookie.serialize())
  }
  if (!session) {
    const cookie = lucia.createBlankSessionCookie()
    res.appendHeader('Set-Cookie', cookie.serialize())
  }

  req.user = user
  req.session = session
  next()
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}
