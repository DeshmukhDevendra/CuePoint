import http from 'node:http'
import { env } from './env.js'
import { logger } from './logger.js'
import { createCuepointAppBundle } from './createExpressApp.js'
import { createSocketServer } from './realtime/io.js'
import {
  createScheduledTimerQueue,
  startScheduledTimerWorker,
} from './queue/scheduledTimers.js'
import { createWebhookQueue, startWebhookWorker } from './queue/webhooks.js'

function parseRedisConnection(url: string) {
  const { hostname, port } = new URL(url)
  return { host: hostname, port: parseInt(port || '6379', 10) }
}

const { app, registerRealtimeRoutes } = createCuepointAppBundle()
const server = http.createServer(app)
const io = createSocketServer(server)
registerRealtimeRoutes(io)

// BullMQ scheduled timer queue + worker
if (env.REDIS_URL) {
  const redisConn = parseRedisConnection(env.REDIS_URL)
  createScheduledTimerQueue(redisConn)
  startScheduledTimerWorker(redisConn, io)
  createWebhookQueue(redisConn)
  startWebhookWorker(redisConn)
  logger.info('BullMQ workers started (scheduled timers + webhooks)')
}

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(
      err,
      `Port ${env.API_PORT} is already in use (another Node process, Playwright webServer, or an old API instance). Stop that process or set API_PORT to a free port in .env.`
    )
    process.exit(1)
  }
  throw err
})

server.listen(env.API_PORT, () => {
  logger.info(`🚀 CuePoint API listening on http://localhost:${env.API_PORT}`)
})
