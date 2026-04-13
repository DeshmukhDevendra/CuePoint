/**
 * Time utilities shared between server and clients.
 *
 * Core principle: the server never broadcasts ticks. Clients compute
 * remaining time locally from { startedAt, pausedAt, durationMs, elapsedMs }
 * and a per-client `clockOffsetMs` derived from an initial handshake.
 */

export interface TimerState {
  durationMs: number
  /** Time Warp: if set, viewer outputs display this duration instead of durationMs. */
  displayMs?: number | null
  isRunning: boolean
  startedAt: string | Date | null // ISO or Date of the current run segment
  pausedAt: string | Date | null
  elapsedMs: number // accumulated ms from previous run segments
}

export interface ComputeOpts {
  /** now() on the local device, in ms since epoch */
  nowMs: number
  /** serverNow - clientNow, in ms (positive means server is ahead) */
  clockOffsetMs?: number
}

/** Parse a Date | ISO string | null to epoch ms. */
function toMs(d: string | Date | null): number | null {
  if (d == null) return null
  if (d instanceof Date) return d.getTime()
  const t = Date.parse(d)
  return Number.isNaN(t) ? null : t
}

/** Effective "server now" on this device. */
export function serverNow(opts: ComputeOpts): number {
  return opts.nowMs + (opts.clockOffsetMs ?? 0)
}

/** Total elapsed ms, including the currently-running segment. */
export function computeElapsed(state: TimerState, opts: ComputeOpts): number {
  if (!state.isRunning) return state.elapsedMs
  const start = toMs(state.startedAt)
  if (start == null) return state.elapsedMs
  const now = serverNow(opts)
  return state.elapsedMs + Math.max(0, now - start)
}

/** Remaining ms until the timer hits zero. Can be negative (overrun). */
export function computeRemaining(state: TimerState, opts: ComputeOpts): number {
  return state.durationMs - computeElapsed(state, opts)
}

/**
 * Like computeRemaining but uses displayMs (Time Warp) when set.
 * Use this in viewer/audience-facing outputs.
 */
export function computeViewerRemaining(state: TimerState, opts: ComputeOpts): number {
  const duration = state.displayMs != null ? state.displayMs : state.durationMs
  return duration - computeElapsed(state, opts)
}

/**
 * Format ms as H:MM:SS / MM:SS / -MM:SS for overruns.
 * Rounds toward zero so the last visible second is "00:00" not "-00:01".
 */
export function formatDuration(
  ms: number,
  opts: { showHoursAlways?: boolean; showSign?: boolean } = {}
): string {
  const sign = ms < 0 ? '-' : opts.showSign && ms > 0 ? '+' : ''
  const abs = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0 || opts.showHoursAlways) {
    return `${sign}${h}:${pad(m)}:${pad(s)}`
  }
  return `${sign}${pad(m)}:${pad(s)}`
}

/** Parse "1:30" / "1:30:00" / "90" (seconds) into ms. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map((p) => p.trim())
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null
  const nums = parts.map((p) => parseInt(p, 10))
  if (nums.length === 1) return nums[0]! * 1000
  if (nums.length === 2) return (nums[0]! * 60 + nums[1]!) * 1000
  if (nums.length === 3) return (nums[0]! * 3600 + nums[1]! * 60 + nums[2]!) * 1000
  return null
}

/** Color phase for wrap-up rendering. */
export type WrapupPhase = 'normal' | 'yellow' | 'red' | 'over'

export function wrapupPhase(
  remainingMs: number,
  yellowMs: number | null | undefined,
  redMs: number | null | undefined
): WrapupPhase {
  if (remainingMs < 0) return 'over'
  if (redMs != null && remainingMs <= redMs) return 'red'
  if (yellowMs != null && remainingMs <= yellowMs) return 'yellow'
  return 'normal'
}
