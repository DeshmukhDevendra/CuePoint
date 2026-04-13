import { Lucia } from 'lucia'
import { PrismaAdapter } from '@lucia-auth/adapter-prisma'
import { prisma } from '@cuepoint/db'
import { env } from '../env.js'

const adapter = new PrismaAdapter(prisma.session, prisma.user)

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: env.SESSION_COOKIE_NAME,
    expires: false,
    attributes: {
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attrs) => ({
    email: attrs.email,
    name: attrs.name,
    locale: attrs.locale,
    theme: attrs.theme,
  }),
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseUserAttributes: {
      email: string
      name: string | null
      locale: string
      theme: string
    }
  }
}
