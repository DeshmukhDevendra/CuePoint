import express from 'express'
import cors from 'cors'
import { pinoHttp } from 'pino-http'
import type { Server as SocketIOServer } from 'socket.io'
import { env } from './env.js'
import { logger } from './logger.js'
import { attachSession } from './auth/middleware.js'
import { authRouter } from './routes/auth.js'
import { roomsRouter } from './routes/rooms.js'
import { makePublicRoomsRouter } from './routes/publicRooms.js'
import { makeMessagesRouter } from './routes/messages.js'
import { makeSubmitConfigRouter } from './routes/submitConfig.js'
import { makeOutputsRouter } from './routes/outputs.js'
import { makePublicOutputLinksRouter } from './routes/publicOutputLinks.js'
import { makeRoomLiveRouter } from './routes/roomLive.js'
import { makeTimersRouter } from './routes/timers.js'
import { makeLabelsRouter } from './routes/labels.js'
import { logsRouter } from './routes/logs.js'
import { webhooksRouter } from './routes/webhooks.js'
import { makeApiV1Router } from './routes/apiV1.js'
import { makeGeneralLimiter } from './lib/rateLimiter.js'
import { teamsRouter } from './routes/teams.js'

export type CuepointAppBundle = {
  app: express.Application
  /** Call once after {@link createSocketServer} has been bound to the same HTTP server. */
  registerRealtimeRoutes: (io: SocketIOServer) => void
}

/**
 * HTTP middleware and routes that do not need a Socket.IO instance.
 * Realtime routes are registered via {@link CuepointAppBundle.registerRealtimeRoutes}.
 */
export function createCuepointAppBundle(): CuepointAppBundle {
  const app = express()

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(pinoHttp({ logger }))
  app.use(attachSession)

  // General rate limit on all /api/* routes
  app.use('/api', makeGeneralLimiter())

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

  app.use('/api/auth', authRouter)
  app.use('/api/teams', teamsRouter)
  app.use('/api/rooms', roomsRouter)
  app.use('/api/public/output-links', makePublicOutputLinksRouter())
  app.use('/api/rooms/:roomId/outputs', makeOutputsRouter())

  function registerRealtimeRoutes(io: SocketIOServer) {
    app.use('/api/v1', makeApiV1Router(io))
    app.use('/api/public/rooms', makePublicRoomsRouter(io))
    app.use('/api/rooms/:roomId/timers', makeTimersRouter(io))
    app.use('/api/rooms/:roomId/messages', makeMessagesRouter(io))
    app.use('/api/rooms/:roomId/submit-config', makeSubmitConfigRouter(io))
    app.use('/api/rooms/:roomId/live', makeRoomLiveRouter(io))
    app.use('/api/rooms/:roomId/labels', makeLabelsRouter(io))
    app.use('/api/rooms/:roomId/logs', logsRouter)
    app.use('/api/rooms/:roomId/webhooks', webhooksRouter)

    app.use((_req, res) => res.status(404).json({ error: 'not_found' }))

    app.use(
      (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        logger.error({ err }, 'unhandled error')
        res.status(500).json({ error: 'internal_error' })
      }
    )
  }

  return { app, registerRealtimeRoutes }
}
