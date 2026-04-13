import { useEffect, useRef, useState } from 'react'
import {
  computeRemaining,
  computeViewerRemaining,
  formatDuration,
  wrapupPhase,
  type TimerState,
} from '@cuepoint/shared'
import { getClockOffset } from './useSocket'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'

type TimerWithWrapup = TimerState & {
  id?: string
  wrapupYellowMs?: number | null
  wrapupRedMs?: number | null
}

export function useTimerDisplay(
  timer: TimerWithWrapup,
  /** Positive = feed is delayed (show timers slightly "behind" wall clock). */
  streamDelaySec = 0,
  opts: {
    /** Use displayMs (Time Warp) for rendering — set true on viewer/audience outputs. */
    viewerMode?: boolean
    /**
     * When set, fires a one-shot 'expire' action when the timer naturally hits 0.
     * Only triggers if timer is LINKED (auto-advance) or if explicitly requested.
     */
    roomId?: string
    autoExpire?: boolean
  } = {}
) {
  const delayMs = streamDelaySec * 1000

  const [remainingMs, setRemainingMs] = useState(() =>
    opts.viewerMode
      ? computeViewerRemaining(timer, { nowMs: Date.now(), clockOffsetMs: getClockOffset() - delayMs })
      : computeRemaining(timer, { nowMs: Date.now(), clockOffsetMs: getClockOffset() - delayMs })
  )
  const rafRef = useRef<number>(0)
  const timerRef = useRef(timer)
  const expiredRef = useRef(false)
  timerRef.current = timer

  // Reset expiry sentinel when the timer restarts
  useEffect(() => {
    if (timer.isRunning) expiredRef.current = false
  }, [timer.isRunning])

  useEffect(() => {
    const tick = () => {
      const t = timerRef.current
      const clockOpts = { nowMs: Date.now(), clockOffsetMs: getClockOffset() - delayMs }
      const ms = opts.viewerMode ? computeViewerRemaining(t, clockOpts) : computeRemaining(t, clockOpts)
      setRemainingMs(ms)

      // Auto-expire: fire once when the timer crosses zero while running
      if (
        opts.autoExpire &&
        opts.roomId &&
        t.isRunning &&
        ms <= 0 &&
        !expiredRef.current
      ) {
        expiredRef.current = true
        void api.post(
          `/rooms/${opts.roomId}/timers/${t.id ?? ''}/action`,
          { action: 'expire' },
          roomControlInit(opts.roomId)
        )
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [delayMs, opts.viewerMode, opts.autoExpire, opts.roomId])

  const phase = wrapupPhase(remainingMs, timer.wrapupYellowMs ?? null, timer.wrapupRedMs ?? null)
  const display = formatDuration(remainingMs)

  return { remainingMs, display, phase }
}
