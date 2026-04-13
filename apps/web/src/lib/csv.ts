import type { Timer } from '@cuepoint/db'
import { parseDuration, formatDuration } from '@cuepoint/shared'

const HEADERS = ['order', 'title', 'speaker', 'duration', 'notes', 'appearance']

export function timersToCSV(timers: Timer[]): string {
  const rows = timers.map((t) => [
    t.order,
    t.title ?? '',
    t.speaker ?? '',
    formatDuration(t.durationMs),
    (t.notes ?? '').replace(/\n/g, ' '),
    t.appearance,
  ])
  const escape = (v: unknown) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [HEADERS.join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export interface CSVTimerRow {
  title: string
  speaker: string
  durationMs: number
  notes: string
  appearance: string
}

export function parseTimersCSV(text: string): CSVTimerRow[] | { error: string } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { error: 'File is empty or has no data rows.' }

  const header = lines[0]!.toLowerCase().split(',').map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)

  const titleIdx = col('title')
  const durationIdx = col('duration')
  if (titleIdx === -1 || durationIdx === -1) {
    return { error: 'CSV must have at minimum "title" and "duration" columns.' }
  }

  const speakerIdx = col('speaker')
  const notesIdx = col('notes')
  const appearanceIdx = col('appearance')

  const VALID_APPEARANCES = new Set([
    'COUNTDOWN','COUNT_UP','TIME_OF_DAY','COUNTDOWN_TOD','COUNT_UP_TOD','HIDDEN',
  ])

  const results: CSVTimerRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]!)
    const rawDuration = cols[durationIdx]?.trim() ?? ''
    const durationMs = parseDuration(rawDuration)
    if (durationMs === null) {
      return { error: `Row ${i + 1}: invalid duration "${rawDuration}". Use MM:SS or H:MM:SS.` }
    }
    const rawAppearance = (cols[appearanceIdx]?.trim() ?? '').toUpperCase()
    const appearance = VALID_APPEARANCES.has(rawAppearance) ? rawAppearance : 'COUNTDOWN'
    results.push({
      title: cols[titleIdx]?.trim() ?? '',
      speaker: speakerIdx >= 0 ? (cols[speakerIdx]?.trim() ?? '') : '',
      durationMs,
      notes: notesIdx >= 0 ? (cols[notesIdx]?.trim() ?? '') : '',
      appearance,
    })
  }
  return results
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(cur); cur = '' }
      else cur += ch
    }
  }
  result.push(cur)
  return result
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
