import rateLimit from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { getRedis } from './redisClient.js'

/** General API rate limit: 120 req / min per IP */
export function makeGeneralLimiter() {
  const client = getRedis()
  return rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    ...(client
      ? {
          store: new RedisStore({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sendCommand: (...args: string[]) => (client as any).call(...args),
            prefix: 'rl:general:',
          }),
        }
      : {}),
  })
}

/** Strict limit for external API v1: 60 req / min per API key */
export function makeApiV1Limiter() {
  const client = getRedis()
  return rateLimit({
    windowMs: 60_000,
    max: 60,
    keyGenerator: (req) => {
      const auth = req.headers.authorization ?? ''
      return auth.startsWith('Bearer ') ? auth.slice(7) : req.ip ?? 'unknown'
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...(client
      ? {
          store: new RedisStore({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sendCommand: (...args: string[]) => (client as any).call(...args),
            prefix: 'rl:apiv1:',
          }),
        }
      : {}),
  })
}
