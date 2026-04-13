import { PrismaClient } from '../generated/prisma/index.js'

// Avoid exhausting connections during Vite/tsx hot-reload in dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export * from '../generated/prisma/index.js'
export { Prisma } from '../generated/prisma/index.js'
