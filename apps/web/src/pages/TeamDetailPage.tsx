import { useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/stores/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Card, Input } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { PLAN_LIMITS, PLAN_DISPLAY_NAMES, PLAN_DESCRIPTIONS, isUnlimited, type PlanTier } from '@cuepoint/shared'
import { cn } from '@/lib/cn'

interface TeamMember {
  id: string
  role: string
  createdAt: string
  user: { id: string; name: string | null; email: string }
}

interface TeamInvite {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
}

interface TeamRoom {
  id: string
  title: string
  onAir: boolean
  createdAt: string
}

interface TeamDetail {
  id: string
  name: string
  plan: string
  apiKey: string
  role: string
  createdAt: string
  members: TeamMember[]
  rooms: TeamRoom[]
  invites: TeamInvite[]
}

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const { me } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null)
  const [lastInviteEmailSent, setLastInviteEmailSent] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const { data: team, isLoading, isError } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.get<TeamDetail>(`/teams/${teamId}`),
    retry: false,
  })

  const canAdmin = team?.role === 'OWNER' || team?.role === 'ADMIN'
  const isOwner = team?.role === 'OWNER'

  const updateName = useMutation({
    mutationFn: (name: string) => api.patch(`/teams/${teamId}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      qc.invalidateQueries({ queryKey: ['teams'] })
      setEditingName(false)
    },
  })

  const invite = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      api.post<{ token: string; emailSent: boolean }>(`/teams/${teamId}/invite`, { email, role }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team', teamId] })
      setInviteEmail('')
      setInviteError(null)
      setLastInviteToken(res.token)
      setLastInviteEmailSent(res.emailSent)
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        setInviteError('Member limit reached for your plan. Upgrade to invite more members.')
      } else {
        setInviteError('Failed to send invite. Please try again.')
      }
    },
  })

  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) => api.delete(`/teams/${teamId}/invites/${inviteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  })

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/teams/${teamId}/members/${memberId}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  })

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/teams/${teamId}/members/${memberId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  })

  const regenKey = useMutation({
    mutationFn: () => api.post<{ apiKey: string }>(`/teams/${teamId}/regenerate-key`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  })

  const deleteTeam = useMutation({
    mutationFn: () => api.delete(`/teams/${teamId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      navigate('/')
    },
  })

  function onInviteSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    invite.mutate({ email: inviteEmail.trim(), role: inviteRole })
  }

  function onRenameSubmit(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    updateName.mutate(newName.trim())
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="text-center space-y-3 py-6 px-8">
          <p className="text-destructive font-medium">Team not found</p>
          <Link to="/teams"><Button className="bg-muted text-foreground">Back to Teams</Button></Link>
        </Card>
      </div>
    )
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
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Rooms</Link>
          <span>/</span>
          <Link to="/teams" className="hover:text-foreground">Teams</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{team.name}</span>
        </div>

        {/* Team name + rename */}
        <div className="flex items-start justify-between gap-4">
          {editingName ? (
            <form onSubmit={onRenameSubmit} className="flex gap-3 flex-1">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" disabled={updateName.isPending}>Save</Button>
              <Button
                type="button"
                className="bg-muted text-foreground"
                onClick={() => setEditingName(false)}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div>
              <h2 className="text-2xl font-semibold">{team.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Plan: <span className="capitalize">{team.plan.toLowerCase()}</span> ·{' '}
                Your role: <span className="capitalize">{team.role.toLowerCase()}</span>
              </p>
            </div>
          )}
          {canAdmin && !editingName && (
            <Button
              className="bg-muted text-foreground text-sm"
              onClick={() => { setNewName(team.name); setEditingName(true) }}
            >
              Rename
            </Button>
          )}
        </div>

        {/* Plan & Usage */}
        {(() => {
          const plan = (team.plan ?? 'FREE') as PlanTier
          const limits = PLAN_LIMITS[plan]
          const memberCount = team.members.length
          const roomCount = team.rooms.length
          const planColor = plan === 'PREMIUM'
            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
            : plan === 'PRO'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'

          function UsageBar({ current, limit, label }: { current: number; limit: number; label: string }) {
            const pct = isUnlimited(limit) ? 0 : Math.min(100, (current / limit) * 100)
            const nearLimit = !isUnlimited(limit) && pct >= 80
            return (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{label}</span>
                  <span>{current} / {isUnlimited(limit) ? '∞' : limit}</span>
                </div>
                {!isUnlimited(limit) && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', nearLimit ? 'bg-red-500' : 'bg-primary')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          }

          return (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', planColor)}>
                      {PLAN_DISPLAY_NAMES[plan]}
                    </span>
                    <span className="text-sm text-muted-foreground">plan</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{PLAN_DESCRIPTIONS[plan]}</p>
                </div>
                {plan === 'FREE' && isOwner && (
                  <a
                    href="mailto:hello@cuepoint.app?subject=Upgrade%20CuePoint%20Plan"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Upgrade →
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UsageBar current={memberCount} limit={limits.teamMembers} label="Team members" />
                <UsageBar current={roomCount} limit={limits.rooms} label="Team rooms" />
              </div>
            </Card>
          )
        })()}

        {/* Members */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Members</h3>
            {canAdmin && (
              <Button
                className="text-sm"
                onClick={() => setShowInviteForm((v) => !v)}
              >
                {showInviteForm ? 'Cancel' : '+ Invite'}
              </Button>
            )}
          </div>

          {showInviteForm && (
            <Card>
              <form onSubmit={onInviteSubmit} className="flex flex-wrap gap-3">
                <Input
                  autoFocus
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'ADMIN')}
                  className="rounded border bg-background px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? 'Sending…' : 'Send Invite'}
                </Button>
              </form>
              {lastInviteToken && (
                <div className="mt-3 space-y-2">
                  {lastInviteEmailSent ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                      <span className="text-green-600 text-sm">✓</span>
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                        Invite email sent successfully.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
                        Email not configured — share this link manually:
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-muted px-2 py-1 text-xs break-all font-mono">
                          {`${window.location.origin}/accept-invite?token=${lastInviteToken}`}
                        </code>
                        <Button
                          type="button"
                          className="bg-muted text-foreground text-xs shrink-0"
                          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${lastInviteToken}`)}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {inviteError && (
                <p className="mt-2 text-xs text-destructive">{inviteError}</p>
              )}
              {invite.isError && !inviteError && (
                <p className="mt-2 text-xs text-destructive">
                  {(invite.error as Error)?.message ?? 'Failed to send invite'}
                </p>
              )}
            </Card>
          )}

          <div className="space-y-2">
            {team.members.map((m) => (
              <Card key={m.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium text-sm">
                    {m.user.name || m.user.email}
                    {m.user.id === me?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </p>
                  {m.user.name && (
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canAdmin && m.user.id !== me?.id ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ memberId: m.id, role: e.target.value })}
                        className="rounded border bg-background px-2 py-1 text-xs"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                        {isOwner && <option value="OWNER">Owner</option>}
                      </select>
                      <Button
                        className="bg-destructive/10 text-destructive text-xs hover:bg-destructive/20"
                        onClick={() => removeMember.mutate(m.id)}
                        disabled={removeMember.isPending}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground capitalize">
                      {m.role.toLowerCase()}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Pending Invites */}
        {team.invites.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-lg font-medium">Pending Invites</h3>
            <div className="space-y-2">
              {team.invites.map((inv) => (
                <Card key={inv.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {inv.role.toLowerCase()} · Expires{' '}
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {canAdmin && (
                    <Button
                      className="bg-muted text-foreground text-xs"
                      onClick={() => cancelInvite.mutate(inv.id)}
                      disabled={cancelInvite.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Rooms */}
        <section className="space-y-3">
          <h3 className="text-lg font-medium">Team Rooms</h3>
          {team.rooms.length === 0 ? (
            <Card className="text-center text-muted-foreground py-6 text-sm">
              No rooms assigned to this team yet.
            </Card>
          ) : (
            <div className="space-y-2">
              {team.rooms.map((room) => (
                <Card key={room.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    {room.onAir && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                        ON AIR
                      </span>
                    )}
                    <p className="font-medium text-sm">{room.title}</p>
                  </div>
                  <Link to={`/rooms/${room.id}`}>
                    <Button className="text-xs bg-muted text-foreground">Control</Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* API Key */}
        {isOwner && (
          <section className="space-y-3">
            <h3 className="text-lg font-medium">Team API Key</h3>
            <Card className="space-y-3">
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                  {showKey ? team.apiKey : '•'.repeat(32)}
                </code>
                <Button
                  className="bg-muted text-foreground text-xs shrink-0"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button
                  className="bg-muted text-foreground text-xs shrink-0"
                  onClick={() => navigator.clipboard.writeText(team.apiKey)}
                >
                  Copy
                </Button>
              </div>
              <Button
                className="bg-muted text-foreground text-xs"
                onClick={() => regenKey.mutate()}
                disabled={regenKey.isPending}
              >
                {regenKey.isPending ? 'Regenerating…' : 'Regenerate key'}
              </Button>
            </Card>
          </section>
        )}

        {/* Danger Zone */}
        {isOwner && (
          <section className="space-y-3">
            <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
            <Card className="border-destructive/30 space-y-3">
              <p className="text-sm text-muted-foreground">
                Deleting the team will disassociate all rooms. This cannot be undone.
              </p>
              {!confirmDelete ? (
                <Button
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete team
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm">
                    Type <strong>{team.name}</strong> to confirm:
                  </p>
                  <div className="flex gap-3">
                    <Input
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder={team.name}
                    />
                    <Button
                      className="bg-destructive text-white hover:bg-destructive/90"
                      disabled={deleteInput !== team.name || deleteTeam.isPending}
                      onClick={() => deleteTeam.mutate()}
                    >
                      {deleteTeam.isPending ? 'Deleting…' : 'Confirm Delete'}
                    </Button>
                    <Button
                      className="bg-muted text-foreground"
                      onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>
        )}
      </main>
    </div>
  )
}
