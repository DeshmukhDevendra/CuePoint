import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Output, OutputLink } from '@cuepoint/db'
import { parseOutputLinkOptions, type ParsedOutputLinkOptions } from '@cuepoint/shared'
import { Button, Card, Input } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { roomControlInit } from '@/lib/controllerToken'

type OutputWithLinks = Omit<Output, 'passwordHash'> & { hasPassword: boolean; links: OutputLink[] }

type CreatedLinkResponse = OutputLink & {
  path: string
  shortPath: string | null
  qrUrl: string
  qrShortUrl: string | null
}

type LinkAdvancedForm = {
  identifier: string
  mirror: boolean
  delaySec: string
  timezone: string
  hideControls: boolean
}

function defaultLinkAdvanced(): LinkAdvancedForm {
  return { identifier: '', mirror: false, delaySec: '', timezone: '', hideControls: false }
}

/** Body for `POST .../links` — only sends keys the strict schema allows. */
function buildCreateLinkBody(form: LinkAdvancedForm): { options?: ParsedOutputLinkOptions } {
  const options: ParsedOutputLinkOptions = {}
  const id = form.identifier.trim()
  if (id) options.identifier = id
  if (form.mirror) options.mirror = true
  const delay = parseInt(form.delaySec, 10)
  if (!Number.isNaN(delay) && delay > 0) options.delaySec = delay
  const tz = form.timezone.trim()
  if (tz) options.timezone = tz
  if (form.hideControls) options.hideControls = true
  if (Object.keys(options).length === 0) return {}
  return { options }
}

function linkOptionsSummary(opts: ParsedOutputLinkOptions): string | null {
  const parts: string[] = []
  if (opts.identifier) parts.push(`ID: ${opts.identifier}`)
  if (opts.mirror) parts.push('Mirror')
  if (opts.delaySec != null && opts.delaySec > 0) parts.push(`Delay ${opts.delaySec}s`)
  if (opts.timezone) parts.push(`TZ ${opts.timezone}`)
  if (opts.hideControls) parts.push('Hide chrome')
  return parts.length ? parts.join(' · ') : null
}

export function OutputLinksSection({ roomId, canMutate }: { roomId: string; canMutate: boolean }) {
  const [outputs, setOutputs] = useState<OutputWithLinks[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [linkAdvancedByOutputId, setLinkAdvancedByOutputId] = useState<Record<string, LinkAdvancedForm>>({})

  const load = useCallback(async () => {
    try {
      const list = await api.get<OutputWithLinks[]>(`/rooms/${roomId}/outputs`, roomControlInit(roomId))
      setOutputs(list)
    } catch {
      setOutputs([])
      setMsg('Could not load output links.')
    }
  }, [roomId])

  useEffect(() => {
    void load()
  }, [load])

  async function createOutput() {
    if (!canMutate) return
    setBusy(true)
    setMsg(null)
    try {
      await api.post(
        `/rooms/${roomId}/outputs`,
        { name: 'Main viewer', type: 'VIEWER' },
        roomControlInit(roomId)
      )
      await load()
    } catch {
      setMsg('Could not create output.')
    } finally {
      setBusy(false)
    }
  }

  async function createCustomOutput() {
    if (!canMutate) return
    setBusy(true)
    setMsg(null)
    try {
      await api.post(
        `/rooms/${roomId}/outputs`,
        { name: 'Custom output', type: 'CUSTOM' },
        roomControlInit(roomId)
      )
      await load()
    } catch {
      setMsg('Could not create custom output.')
    } finally {
      setBusy(false)
    }
  }

  function advancedFor(outputId: string): LinkAdvancedForm {
    return linkAdvancedByOutputId[outputId] ?? defaultLinkAdvanced()
  }

  function patchAdvanced(outputId: string, patch: Partial<LinkAdvancedForm>) {
    setLinkAdvancedByOutputId((prev) => {
      const cur = prev[outputId] ?? defaultLinkAdvanced()
      return { ...prev, [outputId]: { ...cur, ...patch } }
    })
  }

  async function createLink(outputId: string) {
    if (!canMutate) return
    setBusy(true)
    setMsg(null)
    try {
      const body = buildCreateLinkBody(advancedFor(outputId))
      const created = await api.post<CreatedLinkResponse>(
        `/rooms/${roomId}/outputs/${outputId}/links`,
        body,
        roomControlInit(roomId)
      )
      const longAbs = `${window.location.origin}${created.path}`
      const shortAbs = created.shortPath ? `${window.location.origin}${created.shortPath}` : null
      const toCopy = shortAbs ?? longAbs
      await navigator.clipboard.writeText(toCopy)
      setMsg(
        shortAbs
          ? 'Short link copied (fallback: long link in console if clipboard blocked).'
          : 'Long viewer link copied.'
      )
      await load()
    } catch {
      setMsg('Could not create link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Output links</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Short URLs, QR codes, and signed long links. Agenda / moderator URLs ignore the “output link only” viewer
            gate. For CUSTOM outputs, use <span className="text-foreground/80">Edit layout</span> to change the canvas
            (drag, resize, undo, branding, same-room layout import), then create a link to preview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-8 text-xs px-3"
            disabled={!canMutate || busy}
            onClick={() => void createOutput()}
          >
            + Viewer output
          </Button>
          <Button
            type="button"
            className="h-8 text-xs px-3 bg-muted text-foreground"
            disabled={!canMutate || busy}
            onClick={() => void createCustomOutput()}
          >
            + Custom output
          </Button>
        </div>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {!outputs ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : outputs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No outputs yet. Create a viewer output, then generate a link.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          {outputs.map((o) => (
            <li key={o.id} className="rounded-md border bg-card/40 px-3 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{o.name}</span>
                <span className="text-xs text-muted-foreground">{o.type}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  className="h-8 text-xs px-3 bg-muted text-foreground"
                  disabled={!canMutate || busy}
                  onClick={() => void createLink(o.id)}
                >
                  New link (copy short or long)
                </Button>
                {o.type === 'CUSTOM' && (
                  <Link
                    to={`/rooms/${roomId}/outputs/${o.id}/edit`}
                    className={cn(
                      'inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:opacity-90'
                    )}
                  >
                    Edit layout
                  </Link>
                )}
              </div>
              <details className="rounded-md border border-border/60 bg-background/30 px-2 py-1.5 text-xs">
                <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                  Options for the next new link (identifier, mirror, delay…)
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Identifier</span>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. Stage left"
                      disabled={!canMutate || busy}
                      value={advancedFor(o.id).identifier}
                      onChange={(e) => patchAdvanced(o.id, { identifier: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Timezone label</span>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. America/New_York"
                      disabled={!canMutate || busy}
                      value={advancedFor(o.id).timezone}
                      onChange={(e) => patchAdvanced(o.id, { timezone: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Delay (seconds)</span>
                    <Input
                      type="number"
                      min={0}
                      max={86_400}
                      className="h-8 text-xs"
                      placeholder="0"
                      disabled={!canMutate || busy}
                      value={advancedFor(o.id).delaySec}
                      onChange={(e) => patchAdvanced(o.id, { delaySec: e.target.value })}
                    />
                  </label>
                  <div className="flex flex-wrap gap-4 items-center sm:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canMutate || busy}
                        checked={advancedFor(o.id).mirror}
                        onChange={(e) => patchAdvanced(o.id, { mirror: e.target.checked })}
                      />
                      <span>Mirror horizontally</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canMutate || busy}
                        checked={advancedFor(o.id).hideControls}
                        onChange={(e) => patchAdvanced(o.id, { hideControls: e.target.checked })}
                      />
                      <span>Hide on-screen chrome (identifier / TZ / live count)</span>
                    </label>
                  </div>
                </div>
              </details>
              <OutputPasswordControls
                roomId={roomId}
                output={o}
                canMutate={canMutate}
                busy={busy}
                setBusy={setBusy}
                onUpdated={() => void load()}
              />
              {o.links.length > 0 && (
                <ul className="space-y-4">
                  {o.links.map((l) => (
                    <li key={l.id} className="rounded border border-border/60 bg-background/50 p-3 space-y-3">
                      {(() => {
                        const sum = linkOptionsSummary(parseOutputLinkOptions(l.options))
                        return sum ? (
                          <p className="text-[11px] text-foreground/80 border-b border-border/40 pb-2 mb-1">{sum}</p>
                        ) : null
                      })()}
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {l.shortCode && (
                          <p>
                            <span className="text-foreground/80">Short:</span> /o/{l.shortCode}
                          </p>
                        )}
                        <p>
                          <span className="text-foreground/80">Long:</span> …{l.signature.slice(-16)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-4 items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QR (long)</p>
                          <img
                            src={`${apiQrBase()}?signature=${encodeURIComponent(l.signature)}`}
                            alt=""
                            className="w-28 h-28 rounded border bg-white p-1"
                          />
                        </div>
                        {l.shortCode && (
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">QR (short)</p>
                            <img
                              src={`${apiQrBase()}?short=${encodeURIComponent(l.shortCode)}`}
                              alt=""
                              className="w-28 h-28 rounded border bg-white p-1"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function apiQrBase() {
  return `${window.location.origin}/api/public/output-links/qr`
}

function OutputPasswordControls({
  roomId,
  output,
  canMutate,
  busy,
  setBusy,
  onUpdated,
}: {
  roomId: string
  output: OutputWithLinks
  canMutate: boolean
  busy: boolean
  setBusy: (v: boolean) => void
  onUpdated: () => void
}) {
  const [pwd, setPwd] = useState('')

  async function save() {
    if (!pwd.trim()) return
    setBusy(true)
    try {
      await api.patch(
        `/rooms/${roomId}/outputs/${output.id}`,
        { password: pwd.trim() },
        roomControlInit(roomId)
      )
      setPwd('')
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function clearPw() {
    setBusy(true)
    try {
      await api.patch(`/rooms/${roomId}/outputs/${output.id}`, { password: null }, roomControlInit(roomId))
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-border/50 pt-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        Output password (all links for this output). {output.hasPassword ? 'Password is set.' : 'No password.'}
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="password"
          autoComplete="new-password"
          className="max-w-xs h-8 text-xs"
          placeholder="New password"
          value={pwd}
          disabled={!canMutate || busy}
          onChange={(e) => setPwd(e.target.value)}
        />
        <Button type="button" className="h-8 text-xs px-3" disabled={!canMutate || busy || !pwd.trim()} onClick={() => void save()}>
          Save
        </Button>
        <Button
          type="button"
          className="h-8 text-xs px-3 bg-muted text-foreground"
          disabled={!canMutate || busy || !output.hasPassword}
          onClick={() => void clearPw()}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}
