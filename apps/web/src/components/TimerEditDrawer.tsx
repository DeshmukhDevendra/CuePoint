import { useState, useEffect } from 'react'
import type { Timer, Label } from '@cuepoint/db'
import { parseDuration, formatDuration } from '@cuepoint/shared'
import { Button, Drawer, FieldRow, Input, Select, Textarea } from './ui'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'

const APPEARANCES = [
  { value: 'COUNTDOWN', label: 'Countdown' },
  { value: 'COUNT_UP', label: 'Count up' },
  { value: 'TIME_OF_DAY', label: 'Time of day' },
  { value: 'COUNTDOWN_TOD', label: 'Countdown + time of day' },
  { value: 'COUNT_UP_TOD', label: 'Count up + time of day' },
  { value: 'HIDDEN', label: 'Hidden (time still runs)' },
]

const TRIGGERS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'LINKED', label: 'Linked (starts after previous)' },
  { value: 'SCHEDULED', label: 'Scheduled (hard start time)' },
]

function msToInput(ms: number | null | undefined): string {
  if (!ms && ms !== 0) return ''
  const abs = Math.round(Math.abs(ms) / 1000)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface TimerEditDrawerProps {
  timer: Timer | null
  roomId: string
  labels: Label[]
  onClose: () => void
  onSaved: () => void
}

export function TimerEditDrawer({ timer, roomId, labels, onClose, onSaved }: TimerEditDrawerProps) {
  const [title, setTitle] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [notes, setNotes] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [displayInput, setDisplayInput] = useState('')
  const [appearance, setAppearance] = useState('COUNTDOWN')
  const [triggerType, setTriggerType] = useState('MANUAL')
  const [startTime, setStartTime] = useState('')
  const [wrapupYellow, setWrapupYellow] = useState('')
  const [wrapupRed, setWrapupRed] = useState('')
  const [wrapupFlash, setWrapupFlash] = useState(false)
  const [wrapupChime, setWrapupChime] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate fields when timer changes
  useEffect(() => {
    if (!timer) return
    setTitle(timer.title ?? '')
    setSpeaker(timer.speaker ?? '')
    setNotes(timer.notes ?? '')
    setDurationInput(msToInput(timer.durationMs))
    setDisplayInput(msToInput(timer.displayMs))
    setAppearance(timer.appearance)
    setTriggerType(timer.triggerType)
    setStartTime(timer.startTime ? new Date(timer.startTime).toISOString().slice(0, 16) : '')
    setWrapupYellow(msToInput(timer.wrapupYellowMs))
    setWrapupRed(msToInput(timer.wrapupRedMs))
    setWrapupFlash(timer.wrapupFlash)
    setWrapupChime(timer.wrapupChime ?? '')
    setSelectedLabels(timer.labelIds ?? [])
  }, [timer?.id])

  function toggleLabel(id: string) {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    )
  }

  async function save() {
    if (!timer) return
    const durationMs = parseDuration(durationInput)
    if (durationMs === null) {
      setError('Invalid duration. Use MM:SS or H:MM:SS format.')
      return
    }
    const displayMs = displayInput.trim() ? parseDuration(displayInput) : null
    if (displayInput.trim() && displayMs === null) {
      setError('Invalid display duration. Use MM:SS or H:MM:SS format.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await api.patch(
        `/rooms/${roomId}/timers/${timer.id}`,
        {
          title: title || null,
          speaker: speaker || null,
          notes: notes || null,
          durationMs,
          displayMs,
          appearance,
          triggerType,
          startTime: triggerType === 'SCHEDULED' && startTime ? new Date(startTime).toISOString() : null,
          wrapupYellowMs: parseDuration(wrapupYellow),
          wrapupRedMs: parseDuration(wrapupRed),
          wrapupFlash,
          wrapupChime: wrapupChime || null,
          labelIds: selectedLabels,
        },
        roomControlInit(roomId)
      )
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={!!timer} onClose={onClose} title="Edit timer" width="max-w-lg">
      <div className="space-y-5">
        {/* Basic info */}
        <FieldRow label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Welcome & Intro" />
        </FieldRow>

        <FieldRow label="Speaker">
          <Input value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="Jane Doe" />
        </FieldRow>

        <FieldRow label="Duration" hint="Format: MM:SS or H:MM:SS">
          <Input
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            placeholder="05:00"
            className="font-mono"
          />
        </FieldRow>

        <FieldRow label="Display time (audience)" hint="Time Warp — leave blank to show actual duration">
          <Input
            value={displayInput}
            onChange={(e) => setDisplayInput(e.target.value)}
            placeholder="(same as duration)"
            className="font-mono"
          />
        </FieldRow>

        <FieldRow label="Appearance">
          <Select value={appearance} onChange={(e) => setAppearance(e.target.value)}>
            {APPEARANCES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </FieldRow>

        <FieldRow label="Trigger">
          <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </FieldRow>

        {triggerType === 'SCHEDULED' && (
          <FieldRow label="Scheduled start time">
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </FieldRow>
        )}

        {/* Wrap-up cues */}
        <div className="rounded-lg border p-4 space-y-4">
          <p className="text-sm font-medium">Wrap-up cues</p>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Yellow warning" hint="e.g. 01:00">
              <Input
                value={wrapupYellow}
                onChange={(e) => setWrapupYellow(e.target.value)}
                placeholder="01:00"
                className="font-mono"
              />
            </FieldRow>
            <FieldRow label="Red warning" hint="e.g. 00:30">
              <Input
                value={wrapupRed}
                onChange={(e) => setWrapupRed(e.target.value)}
                placeholder="00:30"
                className="font-mono"
              />
            </FieldRow>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={wrapupFlash}
              onChange={(e) => setWrapupFlash(e.target.checked)}
              className="rounded"
            />
            Flash border when in red phase
          </label>

          <FieldRow label="Chime" hint="URL to audio file played at red phase">
            <Input
              value={wrapupChime}
              onChange={(e) => setWrapupChime(e.target.value)}
              placeholder="https://..."
            />
          </FieldRow>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <FieldRow label="Labels">
            <div className="flex flex-wrap gap-2 pt-1">
              {labels.map((label) => {
                const active = selectedLabels.includes(label.id)
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className="rounded-full px-3 py-1 text-xs font-medium border transition-all"
                    style={{
                      backgroundColor: active ? label.color : 'transparent',
                      borderColor: label.color,
                      color: active ? '#fff' : label.color,
                    }}
                  >
                    {label.name}
                  </button>
                )
              })}
            </div>
          </FieldRow>
        )}

        {/* Notes */}
        <FieldRow label="Notes" hint="Visible to operator only">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Speaker bio, cue notes…"
            rows={3}
          />
        </FieldRow>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={onClose} className="bg-muted text-foreground hover:opacity-80">
            Cancel
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
