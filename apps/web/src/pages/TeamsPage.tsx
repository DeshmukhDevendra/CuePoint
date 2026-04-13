import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/api'

interface TeamSummary {
  id: string
  name: string
  plan: string
  role: string
  createdAt: string
  _count: { members: number; rooms: number }
}

export function TeamsPage() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<TeamSummary[]>('/teams'),
  })

  const createTeam = useMutation({
    mutationFn: (name: string) => api.post<TeamSummary>('/teams', { name }),
    onSuccess: (team) => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      setCreating(false)
      setNewName('')
      navigate(`/teams/${team.id}`)
    },
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createTeam.mutate(newName.trim())
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <h1 className="text-lg font-semibold">CuePoint</h1>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
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
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Rooms</Link>
          <span>/</span>
          <span className="text-foreground font-medium">Teams</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Teams</h2>
          <Button onClick={() => setCreating(true)}>+ New Team</Button>
        </div>

        {creating && (
          <Card>
            <form onSubmit={onSubmit} className="flex gap-3">
              <Input
                autoFocus
                placeholder="Team name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button type="submit" disabled={createTeam.isPending}>
                {createTeam.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button
                type="button"
                className="bg-muted text-foreground"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </form>
          </Card>
        )}

        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        {!isLoading && teams.length === 0 && (
          <Card className="text-center text-muted-foreground py-8 space-y-2">
            <p>No teams yet.</p>
            <p className="text-xs">Create a team to collaborate with others on shared rooms.</p>
          </Card>
        )}

        <div className="space-y-3">
          {teams.map((team) => (
            <Card key={team.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{team.name}</p>
                <p className="text-xs text-muted-foreground">
                  {team._count.members} member{team._count.members !== 1 ? 's' : ''} ·{' '}
                  {team._count.rooms} room{team._count.rooms !== 1 ? 's' : ''} ·{' '}
                  <span className="capitalize">{team.role.toLowerCase()}</span>
                </p>
              </div>
              <Link to={`/teams/${team.id}`}>
                <Button className="text-sm">Open</Button>
              </Link>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
