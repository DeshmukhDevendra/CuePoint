/**
 * Webhook delivery queue.
 * Events are enqueued via `enqueueWebhook()` and delivered by a BullMQ worker
 * that POSTs JSON to each registered endpoint for that room + event.
 */
import { Queue, Worker, type Job } from 'bullmq'
import { createHmac } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { prisma } from '@cuepoint/db'
import { logger } from '../logger.js'

/**
 * SSRF guard — resolves the hostname and rejects requests destined for private
 * or loopback IP ranges so a user-supplied webhook URL cannot hit internal services.
 *
 * Covers: loopback (127.x, ::1), link-local (169.254.x.x, fe80::/10),
 * RFC-1918 private (10.x, 172.16-31.x, 192.168.x), and the unspecified address.
 */
async function assertNotSsrf(urlStr: string): Promise<void> {
  let hostname: string
  try {
    hostname = new URL(urlStr).hostname
  } catch {
    throw new Error(`Invalid webhook URL: ${urlStr}`)
  }

  // Strip IPv6 brackets
  const bare = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

  // Resolve to all addresses (A + AAAA)
  let addresses: string[]
  try {
    const records = await lookup(bare, { all: true })
    addresses = records.map((r) => r.address)
  } catch {
    throw new Error(`Could not resolve webhook hostname: ${hostname}`)
  }

  const privateV4 = /^(127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/
  const privateV6 = /^(::1|fc|fd|fe[89ab]|::$)/i

  for (const addr of addresses) {
    if (privateV4.test(addr) || privateV6.test(addr) || addr === '0.0.0.0' || addr === '::') {
      throw new Error(`Webhook URL resolves to a private/internal address: ${addr}`)
    }
  }
}

const QUEUE_NAME = 'webhooks'

interface WebhookJobData {
  roomId: string
  event: string
  payload: unknown
}

let queue: Queue<WebhookJobData> | null = null

export function createWebhookQueue(connection: { host: string; port: number }) {
  queue = new Queue<WebhookJobData>(QUEUE_NAME, { connection })
  queue.on('error', (err) => logger.warn({ err: err.message }, 'Webhook queue error'))
  return queue
}

export async function enqueueWebhook(roomId: string, event: string, payload: unknown) {
  if (!queue) return
  await queue.add('deliver', { roomId, event, payload }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  })
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function startWebhookWorker(connection: { host: string; port: number }) {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      const { roomId, event, payload } = job.data

      const webhooks = await prisma.webhook.findMany({
        where: { roomId, enabled: true },
      })

      const matching = webhooks.filter(
        (wh) => wh.events.length === 0 || wh.events.includes(event)
      )
      if (matching.length === 0) return

      const body = JSON.stringify({
        event,
        roomId,
        timestamp: new Date().toISOString(),
        data: payload,
      })

      await Promise.allSettled(
        matching.map(async (wh) => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'CuePoint-Webhook/1.0',
            'X-Cuepoint-Event': event,
          }
          if (wh.secret) {
            headers['X-Cuepoint-Signature'] = `sha256=${sign(wh.secret, body)}`
          }

          // SSRF protection: ensure target is not a private/internal address
          await assertNotSsrf(wh.url)

          const resp = await fetch(wh.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) })
          if (!resp.ok) {
            throw new Error(`Webhook ${wh.id} → ${wh.url} returned ${resp.status}`)
          }
        })
      )
    },
    {
      connection,
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'Webhook delivery failed')
  })

  return worker
}
