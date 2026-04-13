import { useState, type FormEvent } from 'react'
import { Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/api'

export function OutputLinkUnlockForm({
  signature,
  shortCode,
  onUnlocked,
}: {
  signature?: string
  shortCode?: string
  onUnlocked: () => void
}) {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await api.post(`/public/output-links/unlock`, {
        ...(signature ? { signature } : { shortCode }),
        password,
      })
      setPassword('')
      onUnlocked()
    } catch {
      setErr('Incorrect password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-md w-full space-y-4">
      <h1 className="text-lg font-semibold">Password required</h1>
      <p className="text-sm text-muted-foreground">This output link is protected. Enter the password you were given.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </Button>
      </form>
    </Card>
  )
}
