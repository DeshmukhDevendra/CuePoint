import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Card, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { setControllerToken } from '@/lib/controllerToken'

interface RoomSummary {
  id: string
  title: string
  timezone: string
  onAir: boolean
  /** Omitted on guest-room create responses (public API strips secrets). */
  apiKey?: string
  createdAt: string
}

export function RoomsPage() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const { data: rooms = [], isLoading, isError, error } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get<RoomSummary[]>('/rooms'),
  })

  const createRoom = useMutation({
    mutationFn: (title: string) => api.post<RoomSummary>('/rooms', { title }),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setCreating(false)
      setNewTitle('')
      setCreateError(null)
      navigate(`/rooms/${room.id}`)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        setCreateError('Room limit reached on the Free plan (5 rooms). Assign rooms to a Pro team or delete unused rooms.')
      } else {
        setCreateError('Failed to create room. Please try again.')
      }
    },
  })

  const createGuestRoom = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ room: RoomSummary; controllerToken: string }>('/public/rooms', {
        title: 'Guest room',
      })
      setControllerToken(res.room.id, res.controllerToken)
      return res.room
    },
    onSuccess: (room) => {
      navigate(`/rooms/${room.id}`)
    },
  })

  async function onCreateSubmit(e: FormEvent) {
    e.preventDefault()
    createRoom.mutate(newTitle || 'Untitled Room')
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <h1 className="text-lg font-semibold">CuePoint</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/teams" className="text-sm text-muted-foreground hover:text-foreground">
            Teams
          </Link>
          <span className="text-sm text-muted-foreground">{me?.email}</span>
          <Button
            onClick={async () => { await logout(); navigate('/login') }}
            className="bg-muted text-foreground hover:opacity-80"
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Rooms</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-muted text-foreground hover:opacity-90"
              disabled={createGuestRoom.isPending}
              onClick={() => createGuestRoom.mutate()}
            >
              {createGuestRoom.isPending ? 'Starting…' : 'Guest room'}
            </Button>
            <Button onClick={() => setCreating(true)}>+ New Room</Button>
          </div>
        </div>

        {creating && (
          <Card>
            <form onSubmit={onCreateSubmit} className="flex gap-3">
              <Input
                autoFocus
                placeholder="Room title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Button type="submit" disabled={createRoom.isPending}>
                {createRoom.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button
                type="button"
                className="bg-muted text-foreground"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </form>
            {createError && (
              <p className="mt-2 text-xs text-destructive">{createError}</p>
            )}
          </Card>
        )}

        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        {isError && (
          <Card className="border-destructive/50 bg-destructive/5 text-sm text-destructive">
            Could not load rooms. {error instanceof Error ? error.message : 'Check your connection and try again.'}
          </Card>
        )}

        {!isLoading && !isError && rooms.length === 0 && (
          <Card className="text-center text-muted-foreground space-y-2 py-6">
            <p>No rooms yet.</p>
            <p className="text-xs">
              Use <span className="text-foreground/90 font-medium">Guest room</span> for a quick anonymous controller, or{' '}
              <span className="text-foreground/90 font-medium">+ New Room</span> for a saved title.
            </p>
          </Card>
        )}

        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                {room.onAir && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    ON AIR
                  </span>
                )}
                <div>
                  <p className="font-medium">{room.title}</p>
                  <p className="text-xs text-muted-foreground">{room.timezone}</p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link to={`/rooms/${room.id}/viewer`} target="_blank" rel="noreferrer">
                  <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Viewer</Button>
                </Link>
                <Link to={`/rooms/${room.id}/agenda`} target="_blank" rel="noreferrer">
                  <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Agenda</Button>
                </Link>
                <Link to={`/rooms/${room.id}/moderator`} target="_blank" rel="noreferrer">
                  <Button className="bg-muted text-foreground text-xs sm:text-sm hover:opacity-80">Mod</Button>
                </Link>
                <Link to={`/rooms/${room.id}`}>
                  <Button className="text-xs sm:text-sm">Control</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
