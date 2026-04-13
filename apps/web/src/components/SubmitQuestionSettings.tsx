import { useEffect, useState, type FormEvent } from 'react'
import type { SubmitQuestionConfig } from '@cuepoint/db'
import { Button, Card, Input, Label } from '@/components/ui'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'

export function SubmitQuestionSettings({
  roomId,
  submitConfig,
  canMutate,
}: {
  roomId: string
  submitConfig: SubmitQuestionConfig | null
  canMutate: boolean
}) {
  const [enabled, setEnabled] = useState(true)
  const [closedMessage, setClosedMessage] = useState('')
  const [title, setTitle] = useState('Ask a question')
  const [subtitle, setSubtitle] = useState('')
  const [questionLabel, setQuestionLabel] = useState('Your question')
  const [nameLabel, setNameLabel] = useState('Your name')
  const [hideName, setHideName] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const c = submitConfig
    setEnabled(c?.enabled ?? true)
    setClosedMessage(c?.closedMessage ?? '')
    setTitle(c?.title ?? 'Ask a question')
    setSubtitle(
      c?.subtitle ?? 'Your question may be reviewed before it appears on screen.'
    )
    setQuestionLabel(c?.questionLabel ?? 'Your question')
    setNameLabel(c?.nameLabel ?? 'Your name')
    setHideName(c?.hideName ?? false)
    setLogoUrl(c?.logoUrl ?? '')
  }, [submitConfig])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!canMutate) return
    setSaving(true)
    setMsg(null)
    try {
      await api.patch(
        `/rooms/${roomId}/submit-config`,
        {
          enabled,
          closedMessage: closedMessage.trim() || null,
          title: title.trim() || null,
          subtitle: subtitle.trim() || null,
          questionLabel: questionLabel.trim() || null,
          nameLabel: nameLabel.trim() || null,
          hideName,
          logoUrl: logoUrl.trim() || '',
        },
        roomControlInit(roomId)
      )
      setMsg('Saved.')
    } catch {
      setMsg('Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Audience submit form</h2>
        <p className="text-xs text-muted-foreground">
          Controls the public page at <code className="text-[11px]">/rooms/{roomId}/submit</code>.
        </p>
      </div>

      <form onSubmit={onSave} className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canMutate} onChange={(e) => setEnabled(e.target.checked)} />
          Accept new submissions
        </label>

        <div className="space-y-2">
          <Label htmlFor="sq-closed">Closed message</Label>
          <Input
            id="sq-closed"
            disabled={!canMutate}
            placeholder="Shown when submissions are off"
            value={closedMessage}
            onChange={(e) => setClosedMessage(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sq-title">Page title</Label>
          <Input id="sq-title" disabled={!canMutate} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sq-sub">Subtitle / helper text</Label>
          <textarea
            id="sq-sub"
            disabled={!canMutate}
            rows={2}
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sq-ql">Question field label</Label>
            <Input
              id="sq-ql"
              disabled={!canMutate}
              value={questionLabel}
              onChange={(e) => setQuestionLabel(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sq-nl">Name field label</Label>
            <Input
              id="sq-nl"
              disabled={!canMutate}
              value={nameLabel}
              onChange={(e) => setNameLabel(e.target.value)}
              maxLength={120}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideName} disabled={!canMutate} onChange={(e) => setHideName(e.target.checked)} />
          Hide name field
        </label>

        <div className="space-y-2">
          <Label htmlFor="sq-logo">Logo URL (optional)</Label>
          <Input
            id="sq-logo"
            disabled={!canMutate}
            placeholder="https://…"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            maxLength={2048}
          />
        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

        <Button type="submit" disabled={!canMutate || saving}>
          {saving ? 'Saving…' : 'Save submit form'}
        </Button>
      </form>
    </Card>
  )
}
