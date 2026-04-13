import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Output } from '@cuepoint/db'
import {
  CUSTOM_OUTPUT_ELEMENT_TYPES,
  OutputLayoutSchema,
  createDefaultLayoutElement,
  defaultCustomOutputLayout,
  type CustomOutputElementType,
  type OutputLayout,
  type OutputLayoutElement,
} from '@cuepoint/shared'
import { CustomOutputEditorPreview } from '@/components/CustomOutputEditorPreview'
import { OutputEditorElementInspector } from '@/components/OutputEditorElementInspector'
import { Button, Card, Input } from '@/components/ui'
import { useAuth } from '@/stores/auth'
import { useEditorHistory } from '@/hooks/useEditorHistory'
import { useRoom } from '@/hooks/useRoom'
import { api } from '@/lib/api'
import { roomControlInit } from '@/lib/controllerToken'
import { cn } from '@/lib/cn'

type OutputWire = Omit<Output, 'passwordHash'> & { hasPassword: boolean }

type OutputListRow = Pick<Output, 'id' | 'name' | 'type'>

const ASPECT_OPTIONS: OutputLayout['aspect'][] = ['16:9', '9:16', '4:3', '1:1']
const LOGO_MODES = ['DEFAULT', 'HIDDEN', 'CUSTOM'] as const
type LogoMode = (typeof LOGO_MODES)[number]

const BLACKOUT_STYLES = ['fullscreen', 'dim', 'none'] as const

function hexForColorInput(bg: string | undefined): string {
  if (bg && /^#[0-9A-Fa-f]{6}$/.test(bg)) return bg
  return '#000000'
}

export function OutputEditorPage() {
  const { roomId, outputId } = useParams<{ roomId: string; outputId: string }>()
  const { me } = useAuth()
  const { room, loading, writeAccess } = useRoom(roomId ?? '', 'controller')
  const { text, setLive, commit, undo, redo, reset, beginTextareaSession, endTextareaSession } =
    useEditorHistory('')
  const [loaded, setLoaded] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [outputType, setOutputType] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoMode, setLogoMode] = useState<LogoMode>('DEFAULT')
  const [otherOutputs, setOtherOutputs] = useState<OutputListRow[]>([])
  const [importFromId, setImportFromId] = useState('')
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [newElType, setNewElType] = useState<CustomOutputElementType>('label')
  const [newElId, setNewElId] = useState('')
  const [myRooms, setMyRooms] = useState<{ id: string; title: string }[]>([])
  const [remoteRoomId, setRemoteRoomId] = useState('')
  const [remoteOutputs, setRemoteOutputs] = useState<OutputListRow[]>([])
  const [remoteOutId, setRemoteOutId] = useState('')

  const previewLayout = useMemo((): OutputLayout | null => {
    try {
      const r = OutputLayoutSchema.safeParse(JSON.parse(text) as unknown)
      return r.success ? r.data : null
    } catch {
      return null
    }
  }, [text])

  const selectedEl = useMemo(
    () => previewLayout?.elements.find((e) => e.id === selectedElementId) ?? null,
    [previewLayout, selectedElementId]
  )

  const loadOutput = useCallback(async () => {
    if (!roomId || !outputId) return
    setLoadErr(null)
    try {
      const o = await api.get<OutputWire>(`/rooms/${roomId}/outputs/${outputId}`, roomControlInit(roomId))
      setOutputType(o.type)
      reset(JSON.stringify(o.layout ?? {}, null, 2))
      setLogoUrl(o.logoUrl ?? '')
      setLogoMode((o.logoMode as LogoMode) ?? 'DEFAULT')
      setLoaded(true)
    } catch {
      setLoadErr('Could not load output.')
      setLoaded(false)
    }
  }, [roomId, outputId, reset])

  useEffect(() => {
    void loadOutput()
  }, [loadOutput])

  useEffect(() => {
    if (!roomId || !writeAccess || !loaded) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.get<OutputListRow[]>(`/rooms/${roomId}/outputs`, roomControlInit(roomId))
        if (!cancelled) {
          setOtherOutputs(list.filter((o) => o.id !== outputId))
        }
      } catch {
        if (!cancelled) setOtherOutputs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId, outputId, writeAccess, loaded])

  useEffect(() => {
    if (!me) {
      setMyRooms([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.get<{ id: string; title: string }[]>('/rooms')
        if (!cancelled) setMyRooms(list)
      } catch {
        if (!cancelled) setMyRooms([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me])

  useEffect(() => {
    if (!remoteRoomId || !me) {
      setRemoteOutputs([])
      setRemoteOutId('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await api.get<OutputListRow[]>(`/rooms/${remoteRoomId}/outputs`, roomControlInit(remoteRoomId))
        if (!cancelled) {
          setRemoteOutputs(list)
          setRemoteOutId('')
        }
      } catch {
        if (!cancelled) setRemoteOutputs([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [remoteRoomId, me])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault()
          redo()
        } else {
          e.preventDefault()
          undo()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  function mergeIntoLayout(partial: Partial<Pick<OutputLayout, 'aspect' | 'background'>>) {
    setMsg(null)
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      setMsg('JSON parse error — fix syntax before using quick controls.')
      return
    }
    const base = OutputLayoutSchema.safeParse(raw)
    if (!base.success) {
      setMsg('Layout invalid — fix schema errors before using quick controls.')
      return
    }
    const next = { ...base.data, ...partial }
    commit(JSON.stringify(next, null, 2))
  }

  function mergeLayoutFields(partial: Partial<OutputLayout>) {
    setMsg(null)
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      setMsg('JSON parse error.')
      return
    }
    const base = OutputLayoutSchema.safeParse(raw)
    if (!base.success) {
      setMsg('Layout invalid.')
      return
    }
    const next = { ...base.data, ...partial }
    const parsed = OutputLayoutSchema.safeParse(next)
    if (!parsed.success) {
      setMsg(parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid layout field.')
      return
    }
    commit(JSON.stringify(parsed.data, null, 2))
  }

  function mergeFontFamily(f: string) {
    setMsg(null)
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      setMsg('JSON parse error.')
      return
    }
    const base = OutputLayoutSchema.safeParse(raw)
    if (!base.success) {
      setMsg('Invalid layout.')
      return
    }
    const next: OutputLayout = { ...base.data }
    const t = f.trim()
    if (t) next.fontFamily = t
    else delete next.fontFamily
    commit(JSON.stringify(OutputLayoutSchema.parse(next), null, 2))
  }

  function mergeElement(id: string, patch: Partial<OutputLayoutElement>) {
    setMsg(null)
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      return
    }
    const base = OutputLayoutSchema.safeParse(raw)
    if (!base.success) return
    const elements = base.data.elements.map((el) =>
      el.id === id ? ({ ...el, ...patch } as OutputLayoutElement) : el
    )
    commit(JSON.stringify(OutputLayoutSchema.parse({ ...base.data, elements }), null, 2))
  }

  const handleBoxChange = useCallback(
    (elementId: string, box: OutputLayoutElement['box']) => {
      mergeElement(elementId, { box } as Partial<OutputLayoutElement>)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mergeElement closes over `text` via `commit` chain
    [text]
  )

  async function save() {
    if (!roomId || !outputId || !writeAccess) return
    setMsg(null)
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(text) as unknown
    } catch {
      setMsg('JSON parse error.')
      return
    }
    const parsed = OutputLayoutSchema.safeParse(parsedJson)
    if (!parsed.success) {
      setMsg(parsed.error.issues.map((e) => e.message).join('; ') || 'Invalid layout.')
      return
    }
    let logoPayload: string | null = null
    const trimmed = logoUrl.trim()
    if (trimmed) {
      try {
        logoPayload = new URL(trimmed).toString()
      } catch {
        setMsg('Logo URL must be a valid http(s) URL or empty.')
        return
      }
    }
    setSaving(true)
    try {
      await api.patch(
        `/rooms/${roomId}/outputs/${outputId}`,
        { layout: parsed.data, logoUrl: logoPayload, logoMode },
        roomControlInit(roomId)
      )
      setMsg('Saved.')
    } catch {
      setMsg('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  function insertDefault() {
    commit(JSON.stringify(defaultCustomOutputLayout(), null, 2))
    setMsg(null)
  }

  async function runImport() {
    if (!roomId || !outputId || !importFromId || !writeAccess) return
    setMsg(null)
    setSaving(true)
    try {
      await api.post(
        `/rooms/${roomId}/outputs/${outputId}/import-layout`,
        { fromOutputId: importFromId },
        roomControlInit(roomId)
      )
      await loadOutput()
      setImportFromId('')
      setMsg('Layout imported.')
    } catch {
      setMsg('Import failed.')
    } finally {
      setSaving(false)
    }
  }

  function addLayoutElement() {
    if (!previewLayout) return
    setMsg(null)
    const id = newElId.trim() || `el_${previewLayout.elements.length + 1}`
    if (previewLayout.elements.some((e) => e.id === id)) {
      setMsg('Element id already exists.')
      return
    }
    const el = createDefaultLayoutElement(newElType, id)
    const next = { ...previewLayout, elements: [...previewLayout.elements, el] }
    try {
      commit(JSON.stringify(OutputLayoutSchema.parse(next), null, 2))
      setSelectedElementId(id)
      setNewElId('')
    } catch {
      setMsg('Could not add element (invalid schema).')
    }
  }

  function removeSelectedElement() {
    if (!previewLayout || !selectedElementId) return
    const next = {
      ...previewLayout,
      elements: previewLayout.elements.filter((e) => e.id !== selectedElementId),
    }
    commit(JSON.stringify(OutputLayoutSchema.parse(next), null, 2))
    setSelectedElementId(null)
  }

  async function runRemoteImport() {
    if (!roomId || !outputId || !remoteRoomId || !remoteOutId || !writeAccess || !me) return
    setMsg(null)
    setSaving(true)
    try {
      await api.post(
        `/rooms/${roomId}/outputs/${outputId}/import-layout-remote`,
        { sourceRoomId: remoteRoomId, sourceOutputId: remoteOutId },
        roomControlInit(roomId)
      )
      await loadOutput()
      setRemoteOutId('')
      setMsg('Layout imported from your other room.')
    } catch {
      setMsg('Remote import failed (requires signed-in room owner on both rooms).')
    } finally {
      setSaving(false)
    }
  }

  if (!roomId || !outputId) {
    return <p className="p-6 text-sm text-muted-foreground">Missing room or output.</p>
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        {loading ? 'Loading…' : 'Room unavailable.'}
      </div>
    )
  }

  if (!writeAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">You need controller access to edit this output.</p>
        <Link
          to={`/rooms/${roomId}`}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-md border border-input bg-muted px-4 text-xs font-medium text-foreground'
          )}
        >
          Back to controller
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Output layout</h1>
          <p className="text-xs text-muted-foreground mt-1">
            <Link to={`/rooms/${roomId}`} className="underline underline-offset-2">
              ← Controller
            </Link>
            {' · '}
            {outputId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-9 text-xs px-3 bg-muted border border-input" onClick={() => undo()}>
            Undo
          </Button>
          <Button type="button" className="h-9 text-xs px-3 bg-muted border border-input" onClick={() => redo()}>
            Redo
          </Button>
          <Button
            type="button"
            className="h-9 text-xs px-4 bg-muted text-foreground border border-input"
            onClick={() => insertDefault()}
          >
            Reset template
          </Button>
        </div>
      </div>

      {loadErr && <p className="text-sm text-destructive">{loadErr}</p>}
      {outputType && outputType !== 'CUSTOM' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          This output is not CUSTOM. Saving still writes layout JSON; the public link uses the classic viewer unless the
          output type is CUSTOM.
        </p>
      )}

      <Card className="p-4 space-y-3">
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading output…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-3 min-w-0">
              {previewLayout && previewLayout.elements.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewLayout.elements.map((el) => (
                    <button
                      key={el.id}
                      type="button"
                      className={cn(
                        'rounded-md border px-2 py-1 text-[11px] font-mono',
                        el.id === selectedElementId
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                      )}
                      onClick={() => setSelectedElementId(el.id === selectedElementId ? null : el.id)}
                    >
                      {el.type}:{el.id}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border/70 p-2">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Add element</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[9rem]"
                    value={newElType}
                    onChange={(e) => setNewElType(e.target.value as CustomOutputElementType)}
                  >
                    {CUSTOM_OUTPUT_ELEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs flex-1 min-w-[6rem]">
                  <span className="text-muted-foreground">Id</span>
                  <Input
                    className="h-9 text-xs"
                    placeholder="auto if empty"
                    value={newElId}
                    onChange={(e) => setNewElId(e.target.value)}
                  />
                </label>
                <Button
                  type="button"
                  className="h-9 text-xs bg-muted border border-input"
                  disabled={!previewLayout}
                  onClick={() => addLayoutElement()}
                >
                  Add
                </Button>
              </div>

              {selectedEl && (
                <div className="rounded-md border border-border bg-card/50 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      Element: {selectedEl.type} · {selectedEl.id}
                    </p>
                    <Button
                      type="button"
                      className="h-7 text-[11px] px-2 bg-destructive/15 text-destructive border border-destructive/30"
                      onClick={() => removeSelectedElement()}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                      <label key={k} className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">{k} %</span>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={Math.round(selectedEl.box[k] * 100) / 100}
                          step={0.5}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value)
                            if (Number.isNaN(n)) return
                            mergeElement(selectedEl.id, {
                              box: { ...selectedEl.box, [k]: n },
                            } as Partial<OutputLayoutElement>)
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <OutputEditorElementInspector
                    el={selectedEl}
                    onPatch={(p) => mergeElement(selectedEl.id, p)}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Aspect</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[7rem]"
                    disabled={!previewLayout}
                    value={previewLayout?.aspect ?? '16:9'}
                    onChange={(e) =>
                      mergeIntoLayout({ aspect: e.target.value as OutputLayout['aspect'] })
                    }
                  >
                    {ASPECT_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Background swatch</span>
                  <input
                    type="color"
                    className="h-9 w-14 cursor-pointer rounded border border-input bg-background p-0.5"
                    disabled={!previewLayout}
                    value={hexForColorInput(previewLayout?.background)}
                    onChange={(e) => mergeIntoLayout({ background: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs min-w-[10rem] flex-1">
                  <span className="text-muted-foreground">Background (CSS)</span>
                  <Input
                    className="h-9 text-xs font-mono"
                    disabled={!previewLayout}
                    value={previewLayout?.background ?? '#000000'}
                    onChange={(e) => mergeLayoutFields({ background: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs min-w-[10rem] flex-1">
                  <span className="text-muted-foreground">Background image URL</span>
                  <Input
                    className="h-9 text-xs"
                    placeholder="https://…"
                    disabled={!previewLayout}
                    value={previewLayout?.backgroundImageUrl ?? ''}
                    onChange={(e) =>
                      mergeLayoutFields({
                        backgroundImageUrl: e.target.value.trim() || null,
                      } as Partial<OutputLayout>)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Image fit</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    disabled={!previewLayout}
                    value={previewLayout?.backgroundImageFit ?? 'cover'}
                    onChange={(e) =>
                      mergeLayoutFields({
                        backgroundImageFit: e.target.value as 'cover' | 'contain',
                      })
                    }
                  >
                    <option value="cover">cover</option>
                    <option value="contain">contain</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs min-w-[12rem] flex-1">
                  <span className="text-muted-foreground">Font stack (CSS)</span>
                  <Input
                    className="h-9 text-xs"
                    placeholder="e.g. system-ui, sans-serif"
                    disabled={!previewLayout}
                    defaultValue={previewLayout?.fontFamily ?? ''}
                    key={previewLayout?.fontFamily ?? 'none'}
                    onBlur={(e) => mergeFontFamily(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs min-w-[12rem] flex-1">
                  <span className="text-muted-foreground">Font CSS URL (@font-face)</span>
                  <Input
                    className="h-9 text-xs"
                    placeholder="https://…/fonts.css"
                    disabled={!previewLayout}
                    value={previewLayout?.fontCssUrl ?? ''}
                    onChange={(e) =>
                      mergeLayoutFields({
                        fontCssUrl: e.target.value.trim() || null,
                      } as Partial<OutputLayout>)
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Room blackout on link</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[8rem]"
                    disabled={!previewLayout}
                    value={previewLayout?.blackoutStyle ?? 'fullscreen'}
                    onChange={(e) =>
                      mergeLayoutFields({
                        blackoutStyle: e.target.value as (typeof BLACKOUT_STYLES)[number],
                      })
                    }
                  >
                    {BLACKOUT_STYLES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                <label className="flex flex-col gap-1 text-xs flex-1 min-w-[12rem]">
                  <span className="text-muted-foreground">Logo URL</span>
                  <Input
                    className="h-9 text-xs"
                    placeholder="https://…"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Logo mode</span>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={logoMode}
                    onChange={(e) => setLogoMode(e.target.value as LogoMode)}
                  >
                    {LOGO_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {otherOutputs.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs min-w-[10rem]">
                    <span className="text-muted-foreground">Import layout from</span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={importFromId}
                      onChange={(e) => setImportFromId(e.target.value)}
                    >
                      <option value="">—</option>
                      {otherOutputs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    className="h-9 text-xs bg-muted border border-input"
                    disabled={!importFromId || saving}
                    onClick={() => void runImport()}
                  >
                    Import layout
                  </Button>
                </div>
              )}

              {me && myRooms.filter((r) => r.id !== roomId).length > 0 && (
                <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-muted/20 p-2">
                  <p className="w-full text-[11px] text-muted-foreground">
                    Import layout from another room you own (signed-in only; uses the same controller session where
                    applicable).
                  </p>
                  <label className="flex flex-col gap-1 text-xs min-w-[10rem]">
                    <span className="text-muted-foreground">Source room</span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={remoteRoomId}
                      onChange={(e) => setRemoteRoomId(e.target.value)}
                    >
                      <option value="">—</option>
                      {myRooms
                        .filter((r) => r.id !== roomId)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs min-w-[10rem]">
                    <span className="text-muted-foreground">Source output</span>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={remoteOutId}
                      onChange={(e) => setRemoteOutId(e.target.value)}
                      disabled={!remoteRoomId}
                    >
                      <option value="">—</option>
                      {remoteOutputs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} ({o.type})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    className="h-9 text-xs bg-muted border border-input"
                    disabled={!remoteRoomId || !remoteOutId || saving}
                    onClick={() => void runRemoteImport()}
                  >
                    Import from other room
                  </Button>
                </div>
              )}

              <textarea
                className="w-full min-h-[280px] rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
                spellCheck={false}
                value={text}
                onFocus={() => beginTextareaSession()}
                onBlur={() => endTextareaSession()}
                onChange={(e) => setLive(e.target.value)}
              />
              <div className="flex flex-wrap gap-2 items-center">
                <Button type="button" className="h-9 text-xs" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save layout & branding'}
                </Button>
                <Button
                  type="button"
                  className="h-9 text-xs px-4 bg-muted text-foreground border border-input"
                  onClick={() => void loadOutput()}
                >
                  Reload
                </Button>
              </div>
              {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            </div>
            <div className="space-y-2 min-w-0">
              <h2 className="text-sm font-medium text-foreground">Live preview</h2>
              <p className="text-xs text-muted-foreground">
                Drag dashed frames to move; drag blue corner to resize. Same renderer as the public CUSTOM link.
              </p>
              <CustomOutputEditorPreview
                room={room}
                layout={previewLayout}
                logoUrl={logoUrl}
                logoMode={logoMode}
                editOverlay={
                  previewLayout
                    ? {
                        selectedId: selectedElementId,
                        onSelect: setSelectedElementId,
                        onBoxChange: handleBoxChange,
                      }
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
