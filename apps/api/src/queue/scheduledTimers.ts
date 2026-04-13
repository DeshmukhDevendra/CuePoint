/**
 * BullMQ queue + worker for scheduled timers (triggerType = SCHEDULED).
 *
 * When a timer has triggerType=SCHEDULED and a startTime, we enqueue a delayed
 * job. When the job fires, we start the timer and broadcast to all room clients.
 */
import { Queue, Worker, type Job } from 'bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { prisma } from '@cuepoint/db'
import { S2C } from '@cuepoint/shared'
import { logger } from '../logger.js'

const QUEUE_NAME = 'scheduled-timers'

export interface ScheduledTimerJobData {
  roomId: string
  timerId: string
}

let queue: Queue<ScheduledTimerJobData> | null = null

function jobId(timerId: string) {
  return `timer:${timerId}`
}

/** Initialise the queue (call once with a connected ioredis instance). */
export function createScheduledTimerQueue(connection: { host: string; port: number }) {
  queue = new Queue<ScheduledTimerJobData>(QUEUE_NAME, { connection })
  queue.on('error', (err) => logger.warn({ err: err.message }, 'Scheduled timer queue error'))
  return queue
}

/** Schedule (or reschedule) a timer start job. Delay is ms until startTime. */
export async function scheduleTimer(timerId: string, roomId: string, startTime: Date) {
  if (!queue) throw new Error('Scheduled timer queue not initialised')
  const delayMs = startTime.getTime() - Date.now()
  if (delayMs < 0) return // already in the past, skip

  await queue.add(
    'start',
    { roomId, timerId },
    {
      jobId: jobId(timerId),
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: true,
    }
  )
}

/** Cancel a previously scheduled job (e.g. timer deleted or rescheduled). */
export async function cancelScheduledTimer(timerId: string) {
  if (!queue) return
  const job = await queue.getJob(jobId(timerId))
  if (job) await job.remove()
}

/** Start the worker. Call once at server startup. */
export function startScheduledTimerWorker(
  connection: { host: string; port: number },
  io: SocketIOServer
) {
  const worker = new Worker<ScheduledTimerJobData>(
    QUEUE_NAME,
    async (job: Job<ScheduledTimerJobData>) => {
      const { roomId, timerId } = job.data
      const now = new Date()

      const timer = await prisma.timer.findFirst({
        where: { id: timerId, roomId, triggerType: 'SCHEDULED' },
      })
      if (!timer) return // deleted or changed

      // Idempotent: don't restart if already running
      if (timer.isRunning) return

      const updated = await prisma.timer.update({
        where: { id: timerId },
        data: { isRunning: true, startedAt: now, pausedAt: null, elapsedMs: 0 },
      })

      io.to(`room:${roomId}`).emit(S2C.TIMER_UPDATED, updated)
      logger.info({ timerId, roomId }, 'Scheduled timer started')
    },
    { connection }
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Scheduled timer job failed')
  })

  return worker
}
