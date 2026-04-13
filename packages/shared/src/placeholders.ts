/** Replace `{{room}}`, `{{timer}}`, `{{speaker}}` (case-insensitive, spaces allowed). */
export interface PlaceholderContext {
  roomTitle: string
  timerTitle?: string
  speaker?: string
}

export function applyPlaceholders(text: string, ctx: PlaceholderContext): string {
  return text
    .replace(/\{\{\s*room\s*\}\}/gi, ctx.roomTitle)
    .replace(/\{\{\s*timer\s*\}\}/gi, ctx.timerTitle ?? '')
    .replace(/\{\{\s*speaker\s*\}\}/gi, ctx.speaker ?? '')
}
