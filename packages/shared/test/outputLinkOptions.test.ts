import { describe, expect, it } from 'vitest'
import { parseOutputLinkOptions } from '../src/outputLinkOptions.js'

describe('parseOutputLinkOptions', () => {
  it('returns empty object for null and undefined', () => {
    expect(parseOutputLinkOptions(null)).toEqual({})
    expect(parseOutputLinkOptions(undefined)).toEqual({})
  })

  it('returns empty object for non-object', () => {
    expect(parseOutputLinkOptions('x')).toEqual({})
    expect(parseOutputLinkOptions(3)).toEqual({})
  })

  it('returns empty object when strict schema rejects extra keys', () => {
    expect(parseOutputLinkOptions({ mirror: true, extra: 1 })).toEqual({})
  })

  it('parses known fields', () => {
    expect(
      parseOutputLinkOptions({
        mirror: true,
        delaySec: 5,
        timezone: 'America/New_York',
        hideControls: true,
        identifier: 'Downstage',
      })
    ).toEqual({
      mirror: true,
      delaySec: 5,
      timezone: 'America/New_York',
      hideControls: true,
      identifier: 'Downstage',
    })
  })

  it('treats empty object as valid default', () => {
    expect(parseOutputLinkOptions({})).toEqual({})
  })
})
