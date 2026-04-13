import { randomBytes } from 'node:crypto'

/** Lowercase alnum without 0/o/1/l/i ambiguity (fits URL paths). */
const ALPH = '23456789abcdefghjkmnpqrstvwxyz'

export function randomShortCode(len = 8): string {
  const bytes = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPH[bytes[i]! % ALPH.length]!
  return s
}
