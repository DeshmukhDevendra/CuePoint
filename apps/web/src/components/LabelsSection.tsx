import { useState } from 'react'
import type { Label } from '@cuepoint/db'
import { Button, Input } from './ui'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

interface LabelsSectionProps {
  roomId: string
  labels: Label[]
}

export function LabelsSection({ roomId, labels }: LabelsSectionProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0]!)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function addLabel() {
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.post(`/rooms/${roomId}/labels`, { name: name.trim(), color }, roomControlInit(roomId))
      setName('')
      setShowForm(false)
    } finally {
      setAdding(false)
    }
  }

  async function deleteLabel(id: string) {
    await api.delete(`/rooms/${roomId}/labels/${id}`, roomControlInit(roomId))
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">Labels</p>
        <Button
          className="h-7 px-2 text-xs bg-muted text-foreground hover:opacity-80"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ Add'}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 border-t pt-3">
          <Input
            placeholder="Label name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLabel()}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: color === c ? 'white' : c }}
                aria-label={c}
              />
            ))}
          </div>
          <Button
            className="w-full h-8 text-sm"
            onClick={addLabel}
            disabled={adding || !name.trim()}
          >
            {adding ? 'Adding…' : 'Add label'}
          </Button>
        </div>
      )}

      {labels.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">No labels yet. Add one to tag timers.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <div key={label.id} className="group relative">
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
              <button
                type="button"
                onClick={() => deleteLabel(label.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-white/70 hover:text-white"
                aria-label="Delete label"
              >
                ✕
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
