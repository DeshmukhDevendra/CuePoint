import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { Button, Card, Input, Label } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { setControllerToken } from '@/lib/controllerToken'

export function LoginPage() {
  const login = useAuth((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [guestStarting, setGuestStarting] = useState(false)

  async function startGuestRoom() {
    setGuestStarting(true)
    try {
      const res = await api.post<{ room: { id: string }; controllerToken: string }>('/public/rooms', {})
      setControllerToken(res.room.id, res.controllerToken)
      navigate(`/rooms/${res.room.id}`)
    } finally {
      setGuestStarting(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'login_failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Welcome back to CuePoint.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link to="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>

        <div className="border-t pt-4">
          <Button
            type="button"
            className="w-full bg-muted/50 text-foreground"
            disabled={guestStarting}
            onClick={() => void startGuestRoom()}
          >
            {guestStarting ? 'Opening…' : 'Try without an account'}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Creates a guest room in this browser. Save it to your account later from the controller.
          </p>
        </div>
      </Card>
    </div>
  )
}
