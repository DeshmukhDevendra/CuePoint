import { describe, expect, it } from 'vitest'
import {
  computeElapsed,
  computeRemaining,
  formatDuration,
  parseDuration,
  wrapupPhase,
} from '../src/time.js'

describe('formatDuration', () => {
  it('formats mm:ss under one hour', () => {
    expect(formatDuration(90_000)).toBe('01:30')
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formats negative as overrun', () => {
    expect(formatDuration(-1_500)).toBe('-00:01')
  })

  it('includes hours when showHoursAlways', () => {
    expect(formatDuration(90_000, { showHoursAlways: true })).toBe('0:01:30')
  })
})

describe('parseDuration', () => {
  it('parses seconds and colon forms', () => {
    expect(parseDuration('90')).toBe(90_000)
    expect(parseDuration('1:30')).toBe(90_000)
    expect(parseDuration('0:01:30')).toBe(90_000)
  })

  it('returns null for invalid', () => {
    expect(parseDuration('')).toBe(null)
    expect(parseDuration('1:a')).toBe(null)
  })
})

describe('computeElapsed / computeRemaining', () => {
  const t0 = new Date('2026-01-01T12:00:00.000Z').getTime()

  it('uses elapsed only when not running', () => {
    const state = {
      durationMs: 60_000,
      isRunning: false,
      startedAt: null,
      pausedAt: null,
      elapsedMs: 10_000,
    }
    expect(computeElapsed(state, { nowMs: t0 })).toBe(10_000)
    expect(computeRemaining(state, { nowMs: t0 })).toBe(50_000)
  })

  it('adds running segment using clock offset', () => {
    const state = {
      durationMs: 120_000,
      isRunning: true,
      startedAt: new Date(t0 - 15_000).toISOString(),
      pausedAt: null,
      elapsedMs: 5_000,
    }
    expect(computeElapsed(state, { nowMs: t0, clockOffsetMs: 0 })).toBe(20_000)
    expect(computeRemaining(state, { nowMs: t0, clockOffsetMs: 0 })).toBe(100_000)
  })
})

describe('wrapupPhase', () => {
  it('returns phases by thresholds', () => {
    expect(wrapupPhase(30_000, null, null)).toBe('normal')
    expect(wrapupPhase(8_000, 10_000, 5_000)).toBe('yellow')
    expect(wrapupPhase(3_000, 10_000, 5_000)).toBe('red')
    expect(wrapupPhase(-1, 10_000, 5_000)).toBe('over')
  })
})
