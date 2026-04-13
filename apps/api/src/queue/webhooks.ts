/**
 * Webhook delivery queue.
 * Events are enqueued via `enqueueWebhook()` and delivered by a BullMQ worker
 * that POSTs JSON to each registered endpoint for that room + event.
 */
import { Queue, Worker, type Job } from 'bullmq'
import { createHmac } from 'node:crypto'
import { prisma } from '@cuepoint/db'
import { logger } from '../logger.js'

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
