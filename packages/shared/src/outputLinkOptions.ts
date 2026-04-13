import type { z } from 'zod'
import { OutputLinkOptionsSchema } from './schemas.js'

export type ParsedOutputLinkOptions = z.infer<typeof OutputLinkOptionsSchema>

export function parseOutputLinkOptions(raw: unknown): ParsedOutputLinkOptions {
  const r = OutputLinkOptionsSchema.safeParse(raw ?? {})
  return r.success ? r.data : {}
}
