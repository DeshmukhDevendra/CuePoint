import { Redis } from 'ioredis'
import { env } from '../env.js'

let _redis: Redis | null = null

export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null })
    _redis.on('error', () => { /* suppress unhandled error events — BullMQ handles retries */ })
  }
  return _redis
}
