import { useRef, useState } from 'react'
import type { Timer } from '@cuepoint/db'
import { Button } from './ui'
import { timersToCSV, parseTimersCSV, downloadCSV } from '@/lib/csv'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'

interface CSVImportExportProps {
  roomId: string
  timers: Timer[]
  roomTitle: string
}

export function CSVImportExport({ roomId, timers, roomTitle }: CSVImportExportProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; duration: string }[] | null>(null)
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseTimersCSV> | null>(null)

  function handleExport() {
    const csv = timersToCSV(timers)
    const slug = roomTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    downloadCSV(`${slug}-rundown.csv`, csv)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setPreview(null)
    setParsedRows(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseTimersCSV(text)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setParsedRows(result)
      setPreview(
        result.map((r) => ({
          title: r.title || '(untitled)',
          duration: `${Math.floor(r.durationMs / 60000)}:${String(Math.floor((r.durationMs % 60000) / 1000)).padStart(2, '0')}`,
        }))
      )
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!parsedRows || 'error' in parsedRows) return
    setImporting(true)
    setError(null)
    try {
      // Create timers sequentially to preserve order
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i]!
        await api.post(
          `/rooms/${roomId}/timers`,
          { ...row, title: row.title || null, speaker: row.speaker || null, notes: row.notes || null },
          roomControlInit(roomId)
        )
      }
      setPreview(null)
      setParsedRows(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="font-medium text-sm">CSV Import / Export</p>

      <div className="flex flex-wrap gap-2">
        <Button
          className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
          onClick={handleExport}
          disabled={timers.length === 0}
        >
          ↓ Export rundown
        </Button>
        <Button
          className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
          onClick={() => fileRef.current?.click()}
        >
          ↑ Import CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {preview.length} timer{preview.length !== 1 ? 's' : ''} found — will be appended to existing list:
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {preview.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-xs rounded bg-muted px-2 py-1">
                <span className="truncate">{row.title}</span>
                <span className="font-mono text-muted-foreground shrink-0 ml-2">{row.duration}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="h-8 px-3 text-xs flex-1" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Add ${preview.length} timers`}
            </Button>
            <Button
              className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
              onClick={() => { setPreview(null); setParsedRows(null); if (fileRef.current) fileRef.current.value = '' }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        CSV columns: <code className="bg-muted px-1 rounded">title, duration, speaker, notes, appearance</code>
      </p>
    </div>
  )
}
