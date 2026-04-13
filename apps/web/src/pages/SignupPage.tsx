import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { Button, Card, Input, Label } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { setControllerToken } from '@/lib/controllerToken'

export function SignupPage() {
  const signup = useAuth((s) => s.signup)
  const navigate = useNavigate()
  const [name, setName] = useState('')
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
      await signup(email, password, name || undefined)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'signup_failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Get started with CuePoint in seconds.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have one?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
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
        </div>
      </Card>
    </div>
  )
}
