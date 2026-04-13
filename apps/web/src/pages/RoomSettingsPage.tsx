import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button, Card, Input } from '@/components/ui'
import { ThemeToggle } from '@/components/ThemeToggle'

interface RoomSettings {
  id: string
  title: string
  timezone: string
  apiKey: string
  teamId?: string | null
}

interface TeamOption {
  id: string
  name: string
  role: string
}

interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  createdAt: string
}

const ALL_EVENTS = [
  'timer.started', 'timer.stopped', 'timer.paused', 'timer.reset',
  'room.on_air', 'room.blackout',
]

export function RoomSettingsPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: room, isLoading, isError } = useQuery({
    queryKey: ['room-settings', roomId],
    queryFn: () => api.get<RoomSettings>(`/rooms/${roomId}`),
    retry: false,
  })

  const [title, setTitle] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [keyVisible, setKeyVisible] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Teams
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<TeamOption[]>('/teams'),
    retry: false,
  })
  const [transferTeamId, setTransferTeamId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferMsg, setTransferMsg] = useState('')

  async function transferToTeam() {
    if (!roomId || !transferTeamId) return
    setTransferring(true)
    setTransferMsg('')
    try {
      await api.post(`/teams/${transferTeamId}/rooms/${roomId}/transfer`, {})
      setTransferMsg('Room assigned to team.')
      void qc.invalidateQueries({ queryKey: ['room-settings', roomId] })
    } catch {
      setTransferMsg('Transfer failed.')
    } finally {
      setTransferring(false)
    }
  }

  // Webhooks
  const { data: webhooks = [], refetch: refetchWebhooks } = useQuery({
    queryKey: ['webhooks', roomId],
    queryFn: () => api.get<Webhook[]>(`/rooms/${roomId}/webhooks`),
    enabled: !!roomId && !!room,
    retry: false,
  })
  const [whUrl, setWhUrl] = useState('')
  const [whEvents, setWhEvents] = useState<string[]>(ALL_EVENTS)
  const [whSecret, setWhSecret] = useState('')
  const [addingWh, setAddingWh] = useState(false)
  const [showAddWh, setShowAddWh] = useState(false)

  useEffect(() => {
    if (room) {
      setTitle(room.title)
      setTimezone(room.timezone)
    }
  }, [room?.id])

  async function saveSettings() {
    if (!roomId) return
    setSaving(true)
    setSaveMsg('')
    try {
      await api.patch(`/rooms/${roomId}`, { title, timezone })
      setSaveMsg('Saved.')
      void qc.invalidateQueries({ queryKey: ['room-settings', roomId] })
    } catch {
      setSaveMsg('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateKey() {
    if (!roomId) return
    await api.post(`/rooms/${roomId}/regenerate-key`, {})
    void qc.invalidateQueries({ queryKey: ['room-settings', roomId] })
  }

  async function addWebhook() {
    if (!roomId || !whUrl) return
    setAddingWh(true)
    try {
      await api.post(`/rooms/${roomId}/webhooks`, {
        url: whUrl,
        events: whEvents,
        secret: whSecret || undefined,
      })
      setWhUrl('')
      setWhSecret('')
      setWhEvents(ALL_EVENTS)
      setShowAddWh(false)
      void refetchWebhooks()
    } finally {
      setAddingWh(false)
    }
  }

  async function deleteWebhook(id: string) {
    if (!roomId) return
    await api.delete(`/rooms/${roomId}/webhooks/${id}`)
    void refetchWebhooks()
  }

  async function deleteRoom() {
    if (!roomId) return
    await api.delete(`/rooms/${roomId}`)
    navigate('/')
  }

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
  }

  if (isError || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Room not found or you don't have access.</p>
        <Link to="/" className="text-primary hover:underline text-sm">← Back to rooms</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to={`/rooms/${roomId}`} className="text-muted-foreground hover:text-foreground text-sm">
            ← Controller
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold">Room Settings</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        {/* General */}
        <Card className="space-y-4 p-5">
          <p className="font-semibold">General</p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Room name</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Room" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Timezone</label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
            <p className="text-xs text-muted-foreground">
              Used for scheduled timer display. Examples: UTC, America/New_York, Europe/London.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {saveMsg && <span className="text-sm text-muted-foreground">{saveMsg}</span>}
          </div>
        </Card>

        {/* API key */}
        <Card className="space-y-4 p-5">
          <p className="font-semibold">API key</p>
          <p className="text-sm text-muted-foreground">
            Use this key to control the room via the HTTP API or Bitfocus Companion.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
              {keyVisible ? room.apiKey : '•'.repeat(Math.min(room.apiKey.length, 40))}
            </code>
            <Button
              className="shrink-0 bg-muted text-foreground hover:opacity-80 text-xs h-9 px-3"
              onClick={() => setKeyVisible((v) => !v)}
            >
              {keyVisible ? 'Hide' : 'Show'}
            </Button>
            <Button
              className="shrink-0 bg-muted text-foreground hover:opacity-80 text-xs h-9 px-3"
              onClick={() => void navigator.clipboard.writeText(room.apiKey)}
            >
              Copy
            </Button>
          </div>

          <Button
            className="bg-muted text-foreground hover:opacity-80 text-sm"
            onClick={() => void regenerateKey()}
          >
            Regenerate key
          </Button>
          <p className="text-xs text-muted-foreground">
            Regenerating invalidates the current key immediately.
          </p>
        </Card>

        {/* Team */}
        {teams.length > 0 && (
          <Card className="space-y-4 p-5">
            <p className="font-semibold">Team</p>
            <p className="text-sm text-muted-foreground">
              {room.teamId
                ? `This room belongs to a team. Reassign it below.`
                : 'Assign this room to one of your teams.'}
            </p>
            <div className="flex items-center gap-3">
              <select
                value={transferTeamId}
                onChange={(e) => setTransferTeamId(e.target.value)}
                className="flex-1 rounded border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a team…</option>
                {teams
                  .filter((t) => t.role === 'OWNER' || t.role === 'ADMIN')
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
              <Button
                disabled={!transferTeamId || transferring}
                onClick={() => void transferToTeam()}
              >
                {transferring ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
            {transferMsg && <p className="text-sm text-muted-foreground">{transferMsg}</p>}
          </Card>
        )}

        {/* Webhooks */}
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Webhooks</p>
            <Button
              className="h-8 px-3 text-xs bg-muted text-foreground hover:opacity-80"
              onClick={() => setShowAddWh((v) => !v)}
            >
              {showAddWh ? 'Cancel' : '+ Add webhook'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            CuePoint will POST JSON to these URLs when events occur in this room.
          </p>

          {showAddWh && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
              <div className="space-y-1">
                <label className="text-xs font-medium">Endpoint URL</label>
                <Input value={whUrl} onChange={(e) => setWhUrl(e.target.value)} placeholder="https://hooks.example.com/..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Signing secret (optional)</label>
                <Input value={whSecret} onChange={(e) => setWhSecret(e.target.value)} placeholder="At least 8 characters" />
                <p className="text-xs text-muted-foreground">Sent as X-Cuepoint-Signature header (HMAC-SHA256).</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Events</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALL_EVENTS.map((ev) => {
                    const on = whEvents.includes(ev)
                    return (
                      <button
                        key={ev}
                        type="button"
                        onClick={() => setWhEvents((prev) => on ? prev.filter((e) => e !== ev) : [...prev, ev])}
                        className={`rounded px-2 py-1 text-xs border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-muted'}`}
                      >
                        {ev}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Button onClick={() => void addWebhook()} disabled={addingWh || !whUrl || whEvents.length === 0}>
                {addingWh ? 'Adding…' : 'Add webhook'}
              </Button>
            </div>
          )}

          {webhooks.length === 0 && !showAddWh && (
            <p className="text-sm text-muted-foreground">No webhooks configured.</p>
          )}

          {webhooks.map((wh) => (
            <div key={wh.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-mono truncate">{wh.url}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{wh.events.join(', ') || 'all events'}</p>
              </div>
              <Button
                className="shrink-0 h-7 px-2 text-xs bg-muted text-foreground hover:opacity-80"
                onClick={() => void deleteWebhook(wh.id)}
              >
                ✕
              </Button>
            </div>
          ))}
        </Card>

        {/* Danger zone */}
        <Card className="space-y-4 border-destructive/40 p-5">
          <p className="font-semibold text-destructive">Danger zone</p>

          {!confirmDelete ? (
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-80"
              onClick={() => setConfirmDelete(true)}
            >
              Delete room
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive font-medium">
                This will permanently delete "{room.title}" and all its timers, messages, and outputs. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  className="bg-destructive text-destructive-foreground hover:opacity-80"
                  onClick={() => void deleteRoom()}
                >
                  Yes, delete permanently
                </Button>
                <Button
                  className="bg-muted text-foreground hover:opacity-80"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
