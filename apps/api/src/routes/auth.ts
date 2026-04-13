import { Router } from 'express'
import { prisma } from '@cuepoint/db'
import { LoginSchema, SignupSchema } from '@cuepoint/shared'
import { lucia } from '../auth/lucia.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { requireUser } from '../auth/middleware.js'

export const authRouter = Router()

authRouter.post('/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() })
  }
  const { email, password, name } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(409).json({ error: 'email_in_use' })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, passwordHash, name: name ?? null },
  })

  const session = await lucia.createSession(user.id, {})
  const cookie = lucia.createSessionCookie(session.id)
  res.appendHeader('Set-Cookie', cookie.serialize())

  return res.status(201).json({ id: user.id, email: user.email, name: user.name })
})

authRouter.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input' })
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }

  let ok = false
  try {
    ok = await verifyPassword(user.passwordHash, password)
  } catch {
    // Hash format mismatch (e.g. legacy seed hash) — treat as wrong password
    return res.status(401).json({ error: 'invalid_credentials' })
  }
  if (!ok) {
    return res.status(401).json({ error: 'invalid_credentials' })
  }

  const session = await lucia.createSession(user.id, {})
  const cookie = lucia.createSessionCookie(session.id)
  res.appendHeader('Set-Cookie', cookie.serialize())

  return res.json({ id: user.id, email: user.email, name: user.name })
})

authRouter.post('/logout', requireUser, async (req, res) => {
  if (req.session) {
    await lucia.invalidateSession(req.session.id)
  }
  const cookie = lucia.createBlankSessionCookie()
  res.appendHeader('Set-Cookie', cookie.serialize())
  return res.status(204).end()
})

authRouter.get('/me', requireUser, async (req, res) => {
  return res.json(req.user)
})
