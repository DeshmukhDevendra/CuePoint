import { describe, expect, it } from 'vitest'
import {
  OutputLayoutSchema,
  defaultCustomOutputLayout,
  parseOutputLayoutOrDefault,
} from '../src/customOutputLayout.js'

describe('defaultCustomOutputLayout', () => {
  it('parses through OutputLayoutSchema', () => {
    const d = defaultCustomOutputLayout()
    const r = OutputLayoutSchema.safeParse(d)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.version).toBe(1)
      expect(r.data.elements.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('OutputLayoutSchema', () => {
  it('accepts a minimal valid layout', () => {
    const raw = {
      version: 1,
      aspect: '16:9',
      background: '#111',
      elements: [
        {
          type: 'label',
          id: 'l1',
          box: { x: 0, y: 0, w: 100, h: 10 },
          text: 'Hello',
        },
      ],
    }
    const r = OutputLayoutSchema.safeParse(raw)
    expect(r.success).toBe(true)
  })

  it('rejects wrong version', () => {
    const r = OutputLayoutSchema.safeParse({
      version: 2,
      elements: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects unknown element type', () => {
    const r = OutputLayoutSchema.safeParse({
      version: 1,
      elements: [
        {
          type: 'typo_element',
          id: 'x',
          box: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('accepts extended element types and layout media fields', () => {
    const raw = {
      version: 1,
      aspect: '16:9',
      background: 'rgba(0,0,0,0.5)',
      backgroundImageUrl: 'https://example.com/bg.jpg',
      backgroundImageFit: 'cover',
      blackoutStyle: 'dim',
      fontCssUrl: 'https://example.com/fonts.css',
      elements: [
        { type: 'wall_clock', id: 'wc', box: { x: 0, y: 0, w: 20, h: 10 }, format: '24h' },
        { type: 'progress_bar', id: 'p', box: { x: 10, y: 50, w: 80, h: 5 }, timerIndex: 0 },
        { type: 'divider', id: 'd', box: { x: 0, y: 40, w: 100, h: 1 }, orientation: 'horizontal' },
      ],
    }
    const r = OutputLayoutSchema.safeParse(raw)
    expect(r.success).toBe(true)
  })

  it('rejects box out of range', () => {
    const r = OutputLayoutSchema.safeParse({
      version: 1,
      elements: [
        {
          type: 'label',
          id: 'l1',
          box: { x: 0, y: 0, w: 101, h: 10 },
          text: 'x',
        },
      ],
    })
    expect(r.success).toBe(false)
  })
})

describe('parseOutputLayoutOrDefault', () => {
  it('returns default for null and garbage', () => {
    const d = defaultCustomOutputLayout()
    expect(parseOutputLayoutOrDefault(null)).toEqual(d)
    expect(parseOutputLayoutOrDefault(undefined)).toEqual(d)
    expect(parseOutputLayoutOrDefault('nope')).toEqual(d)
    expect(parseOutputLayoutOrDefault({})).toEqual(d)
  })

  it('round-trips a valid layout', () => {
    const raw = {
      version: 1,
      aspect: '9:16' as const,
      background: '#222',
      elements: [
        {
          type: 'timer',
          id: 't1',
          box: { x: 10, y: 10, w: 80, h: 40 },
          timerIndex: 2,
        },
      ],
    }
    const parsed = parseOutputLayoutOrDefault(raw)
    expect(parsed.aspect).toBe('9:16')
    expect(parsed.background).toBe('#222')
    expect(parsed.elements[0]).toMatchObject({ type: 'timer', timerIndex: 2 })
  })
})
