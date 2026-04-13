import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Input, Label } from '@/components/ui'
import { api, ApiError } from '@/lib/api'

type PublicSubmitConfig = {
  enabled: boolean
  closedMessage: string | null
  logoUrl: string | null
  title: string
  subtitle: string
  questionLabel: string
  nameLabel: string
  hideName: boolean
}

export function SubmitQuestionPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [cfg, setCfg] = useState<PublicSubmitConfig | null>(null)
  const [cfgErr, setCfgErr] = useState(false)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<PublicSubmitConfig>(`/public/rooms/${roomId}/submit-config`)
        if (!cancelled) setCfg(data)
      } catch {
        if (!cancelled) {
          setCfgErr(true)
          setCfg(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roomId) return
    setBusy(true)
    setStatus('idle')
    setMsg('')
    try {
      await api.post(`/public/rooms/${roomId}/submit-question`, {
        text: text.trim(),
        name: name.trim() || undefined,
      })
      setStatus('ok')
      setMsg('Thanks — your question was sent.')
      setText('')
      setName('')
    } catch (err) {
      setStatus('err')
      if (err instanceof ApiError && err.code === 'submissions_closed') {
        setMsg('Submissions are closed for this event.')
      } else {
        setMsg('Could not send. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background text-muted-foreground">
        Missing room.
      </div>
    )
  }

  if (cfgErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
        <Card className="w-full max-w-md p-6 text-center text-muted-foreground">
          This submit link is invalid or the room no longer exists.
        </Card>
      </div>
    )
  }

  if (!cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  const closedCopy = cfg.closedMessage?.trim() || 'Submissions are closed for this event.'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <Card className="w-full max-w-md space-y-4">
        {cfg.logoUrl && (
          <div className="flex justify-center">
            <img src={cfg.logoUrl} alt="" className="max-h-16 object-contain" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold">{cfg.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{cfg.subtitle}</p>
        </div>

        {!cfg.enabled ? (
          <p className="text-sm text-muted-foreground">{closedCopy}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="q">{cfg.questionLabel}</Label>
              <textarea
                id="q"
                required
                rows={4}
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
              />
            </div>
            {!cfg.hideName && (
              <div className="space-y-2">
                <Label htmlFor="n">{cfg.nameLabel} (optional)</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
            )}
            {status !== 'idle' && (
              <p className={status === 'ok' ? 'text-sm text-green-600' : 'text-sm text-destructive'}>{msg}</p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
