import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { me, loaded } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    if (!loaded || !me || !token || status !== 'idle') return
    setStatus('accepting')
    api
      .post<{ teamId: string }>('/teams/accept-invite', { token })
      .then((res) => {
        setTeamId(res.teamId)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMsg(err?.message ?? 'Invite not found or expired.')
        setStatus('error')
      })
  }, [loaded, me, token, status])

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="text-center space-y-4 py-8 px-10">
          <p className="font-medium">Sign in to accept this invite</p>
          <div className="flex justify-center gap-3">
            <Link to={`/login?next=${encodeURIComponent(window.location.href)}`}>
              <Button>Sign in</Button>
            </Link>
            <Link to={`/signup?next=${encodeURIComponent(window.location.href)}`}>
              <Button className="bg-muted text-foreground">Sign up</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="text-center space-y-4 py-8 px-10">
        {status === 'accepting' && <p className="text-muted-foreground">Accepting invite…</p>}
        {status === 'success' && (
          <>
            <p className="font-medium text-green-600">You've joined the team!</p>
            <Button onClick={() => navigate(`/teams/${teamId}`)}>View team</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="font-medium text-destructive">Could not accept invite</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Link to="/teams">
              <Button className="bg-muted text-foreground">Go to Teams</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  )
}
