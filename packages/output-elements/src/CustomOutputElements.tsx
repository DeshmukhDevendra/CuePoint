import { useEffect, useState, type ReactNode } from 'react'
import type { Message, Timer } from '@cuepoint/db'
import {
  applyPlaceholders,
  computeRemaining,
  formatDuration,
  wrapupPhase,
  type OutputLayoutElement,
  type WrapupPhase,
} from '@cuepoint/shared'
import QRCode from 'qrcode'

export type ElementRenderContext = {
  roomTitle: string
  timers: Timer[]
  messages: Message[]
  nowMs: number
  clockOffsetMs: number
  activeTimer: Timer | null
}

function sortedTimers(timers: Timer[]): Timer[] {
  return [...timers].sort((a, b) => a.order - b.order)
}

export function resolveTimer(timers: Timer[], index: number): Timer | null {
  const s = sortedTimers(timers)
  return s[index] ?? s[0] ?? null
}

function phaseColors(phase: WrapupPhase): { bg: string; fg: string } {
  switch (phase) {
    case 'yellow':
      return { bg: '#000000', fg: '#facc15' }
    case 'red':
      return { bg: '#000000', fg: '#ef4444' }
    case 'over':
      return { bg: '#7f1d1d', fg: '#fecaca' }
    default:
      return { bg: '#000000', fg: '#ffffff' }
  }
}

function bannerMessage(messages: Message[]): Message | null {
  const visible = messages.filter((m) => m.visible)
  return visible.find((m) => m.focus) ?? visible[0] ?? null
}

function messageCreatedMs(m: Message): number {
  const c = m.createdAt
  return c instanceof Date ? c.getTime() : Date.parse(String(c))
}

function visibleMessagesSorted(messages: Message[]): Message[] {
  return messages
    .filter((m) => m.visible)
    .sort((a, b) => {
      const o = a.order - b.order
      if (o !== 0) return o
      return messageCreatedMs(a) - messageCreatedMs(b)
    })
}

function msgColor(color: string): string {
  if (color === 'green') return '#4ade80'
  if (color === 'red') return '#f87171'
  if (color?.startsWith('#')) return color
  return '#fff'
}

export function renderLayoutElement(el: OutputLayoutElement, ctx: ElementRenderContext): ReactNode {
  switch (el.type) {
    case 'timer':
      return <TimerBlock el={el} ctx={ctx} />
    case 'message_strip':
      return <MessageStripBlock el={el} ctx={ctx} />
    case 'label':
      return <LabelBlock el={el} ctx={ctx} />
    case 'progress_bar':
      return <ProgressBarBlock el={el} ctx={ctx} />
    case 'wall_clock':
      return <WallClockBlock el={el} ctx={ctx} />
    case 'room_title':
      return <RoomTitleBlock el={el} ctx={ctx} />
    case 'timer_title_only':
      return <TimerTitleOnlyBlock el={el} ctx={ctx} />
    case 'timer_digits_only':
      return <TimerDigitsOnlyBlock el={el} ctx={ctx} />
    case 'divider':
      return <DividerBlock el={el} />
    case 'image':
      return <ImageBlock el={el} />
    case 'messages_ticker':
      return <MessagesTickerBlock el={el} ctx={ctx} />
    case 'agenda':
      return <AgendaBlock el={el} ctx={ctx} />
    case 'lower_third':
      return <LowerThirdBlock el={el} ctx={ctx} />
    case 'qrcode':
      return <QrBlock el={el} />
    default: {
      const _x: never = el
      return _x
    }
  }
}

function TimerBlock({ el, ctx }: { el: Extract<OutputLayoutElement, { type: 'timer' }>; ctx: ElementRenderContext }) {
  const timer = resolveTimer(ctx.timers, el.timerIndex ?? 0)
  if (!timer) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 'clamp(1rem, 4vw, 2.5rem)',
        }}
      >
        --:--
      </div>
    )
  }
  const remainingMs = computeRemaining(timer, { nowMs: ctx.nowMs, clockOffsetMs: ctx.clockOffsetMs })
  const phase =
    timer.appearance === 'HIDDEN'
      ? ('normal' as const)
      : wrapupPhase(remainingMs, timer.wrapupYellowMs ?? null, timer.wrapupRedMs ?? null)
  const display = timer.appearance === 'HIDDEN' ? '--:--' : formatDuration(remainingMs)
  const colors = phaseColors(phase)
  const wrapFlash = Boolean(timer.wrapupFlash && (phase === 'red' || phase === 'over'))
  const title =
    el.showTitle !== false
      ? applyPlaceholders(timer.title ?? '', {
          roomTitle: ctx.roomTitle,
          timerTitle: timer.title ?? undefined,
          speaker: timer.speaker ?? undefined,
        })
      : ''
  const speaker =
    el.showSpeaker !== false && timer.speaker
      ? applyPlaceholders(timer.speaker, {
          roomTitle: ctx.roomTitle,
          timerTitle: timer.title ?? undefined,
          speaker: timer.speaker ?? undefined,
        })
      : ''
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.35em',
        backgroundColor: colors.bg,
        color: colors.fg,
        transition: 'background-color 0.2s, color 0.2s',
        padding: '0.25rem',
      }}
    >
      {wrapFlash && (
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.35)',
            animation: 'cuepoint-pulse 1.2s ease-in-out infinite',
          }}
          aria-hidden
        />
      )}
      {title ? (
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(0.55rem, 1.6vw, 1.1rem)',
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: 0.6,
            textAlign: 'center',
            maxWidth: '100%',
          }}
        >
          {title}
        </p>
      ) : null}
      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 900,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          fontSize: 'clamp(1.4rem, 8vw, min(18vh, 14vw))',
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        {display}
      </div>
      {speaker ? <p style={{ margin: 0, fontSize: 'clamp(0.5rem, 1.4vw, 1rem)', opacity: 0.55 }}>{speaker}</p> : null}
    </div>
  )
}

function MessageStripBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'message_strip' }>
  ctx: ElementRenderContext
}) {
  const banner = bannerMessage(ctx.messages)
  if (!banner) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: 'rgba(24,24,27,0.92)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      />
    )
  }
  const text = applyPlaceholders(banner.text, {
    roomTitle: ctx.roomTitle,
    timerTitle: ctx.activeTimer?.title ?? undefined,
    speaker: ctx.activeTimer?.speaker ?? undefined,
  })
  const maxLines = el.maxLines ?? 3
  const color = msgColor(banner.color)

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0.35em 0.5em',
        backgroundColor: 'rgba(24,24,27,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        color,
        fontWeight: banner.bold ? 700 : 400,
        textTransform: banner.uppercase ? 'uppercase' : undefined,
        letterSpacing: banner.uppercase ? '0.06em' : undefined,
        animation: banner.flash ? 'cuepoint-pulse 1.2s ease-in-out infinite' : undefined,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'clamp(0.55rem, 2.1vw, 1.35rem)',
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}
      >
        {text}
      </p>
    </div>
  )
}

function LabelBlock({ el, ctx }: { el: Extract<OutputLayoutElement, { type: 'label' }>; ctx: ElementRenderContext }) {
  const text = applyPlaceholders(el.text, {
    roomTitle: ctx.roomTitle,
    timerTitle: ctx.activeTimer?.title ?? undefined,
    speaker: ctx.activeTimer?.speaker ?? undefined,
  })
  const fs = el.fontSizeRem ?? 1.25
  const color = el.color ?? 'rgba(255,255,255,0.75)'

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0.15em',
        color,
        fontSize: `clamp(0.65rem, ${fs * 0.85}rem, 3rem)`,
      }}
    >
      <span style={{ lineHeight: 1.2 }}>{text}</span>
    </div>
  )
}

function ProgressBarBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'progress_bar' }>
  ctx: ElementRenderContext
}) {
  const timer = resolveTimer(ctx.timers, el.timerIndex ?? 0)
  const bar = el.barColor ?? '#4ade80'
  const track = el.trackColor ?? 'rgba(255,255,255,0.12)'
  const thick = el.thicknessRem ?? 0.85
  const horizontal = el.horizontal !== false
  let ratio = 0
  if (timer && timer.durationMs > 0) {
    const rem = computeRemaining(timer, { nowMs: ctx.nowMs, clockOffsetMs: ctx.clockOffsetMs })
    ratio = Math.max(0, Math.min(1, rem / timer.durationMs))
  }

  if (horizontal) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '92%', height: `${thick}rem`, background: track, borderRadius: 9999, overflow: 'hidden' }}>
          <div style={{ width: `${ratio * 100}%`, height: '100%', background: bar, borderRadius: 9999, transition: 'width 0.2s linear' }} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ height: '88%', width: `${thick}rem`, background: track, borderRadius: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ height: `${ratio * 100}%`, width: '100%', background: bar, borderRadius: 9999, transition: 'height 0.2s linear' }} />
      </div>
    </div>
  )
}

function WallClockBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'wall_clock' }>
  ctx: ElementRenderContext
}) {
  const d = new Date(ctx.nowMs + ctx.clockOffsetMs)
  const showSec = el.showSeconds !== false
  const timeStr =
    el.format === '12h'
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: showSec ? '2-digit' : undefined })
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: showSec ? '2-digit' : undefined, hour12: false })
  const color = el.color ?? 'rgba(255,255,255,0.9)'
  const fs = el.fontSizeRem ?? 1.1

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color,
        padding: '0.2em',
      }}
    >
      {el.label ? (
        <span style={{ fontSize: `clamp(0.45rem, ${fs * 0.45}rem, 0.75rem)`, opacity: 0.55, marginBottom: '0.15em' }}>{el.label}</span>
      ) : null}
      <span style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', fontSize: `clamp(0.65rem, ${fs}rem, 2.5rem)`, fontWeight: 600 }}>
        {timeStr}
      </span>
    </div>
  )
}

function RoomTitleBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'room_title' }>
  ctx: ElementRenderContext
}) {
  const raw = el.template ?? '{roomTitle}'
  const text = applyPlaceholders(raw, { roomTitle: ctx.roomTitle })
  const color = el.color ?? 'rgba(255,255,255,0.88)'
  const fs = el.fontSizeRem ?? 1.1
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '0 0.35em',
        color,
        fontSize: `clamp(0.55rem, ${fs}rem, 2rem)`,
        fontWeight: 600,
      }}
    >
      <span style={{ lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  )
}

function TimerTitleOnlyBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'timer_title_only' }>
  ctx: ElementRenderContext
}) {
  const timer = resolveTimer(ctx.timers, el.timerIndex ?? 0)
  const title = timer
    ? applyPlaceholders(timer.title ?? '—', {
        roomTitle: ctx.roomTitle,
        timerTitle: timer.title ?? undefined,
        speaker: timer.speaker ?? undefined,
      })
    : '—'
  const color = el.color ?? 'rgba(255,255,255,0.75)'
  const fs = el.fontSizeRem ?? 1.2
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color,
        fontSize: `clamp(0.55rem, ${fs}rem, 2.5rem)`,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '0.2em',
      }}
    >
      {title}
    </div>
  )
}

function TimerDigitsOnlyBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'timer_digits_only' }>
  ctx: ElementRenderContext
}) {
  const timer = resolveTimer(ctx.timers, el.timerIndex ?? 0)
  const display =
    !timer || timer.appearance === 'HIDDEN'
      ? '--:--'
      : formatDuration(computeRemaining(timer, { nowMs: ctx.nowMs, clockOffsetMs: ctx.clockOffsetMs }))
  const color = el.color ?? '#fff'
  const scale = el.fontSizeScale ?? 1
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'ui-monospace, monospace',
        fontWeight: 900,
        fontVariantNumeric: 'tabular-nums',
        color,
        fontSize: `clamp(1rem, ${6 * scale}vw, min(${22 * scale}vh, ${18 * scale}vw))`,
        userSelect: 'none',
      }}
    >
      {display}
    </div>
  )
}

function DividerBlock({ el }: { el: Extract<OutputLayoutElement, { type: 'divider' }> }) {
  const color = el.color ?? 'rgba(255,255,255,0.2)'
  const t = el.thicknessPx ?? 2
  const isVertical = el.orientation === 'vertical'
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={
          isVertical
            ? { width: `${t}px`, height: '88%', background: color, borderRadius: 9999 }
            : { height: `${t}px`, width: '92%', background: color, borderRadius: 9999 }
        }
      />
    </div>
  )
}

function ImageBlock({ el }: { el: Extract<OutputLayoutElement, { type: 'image' }> }) {
  const fit = el.fit ?? 'cover'
  const r = el.borderRadiusRem ?? 0
  const op = el.opacity ?? 1
  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', borderRadius: `${r}rem`, overflow: 'hidden' }}>
      <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: fit, opacity: op, display: 'block' }} />
    </div>
  )
}

function MessagesTickerBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'messages_ticker' }>
  ctx: ElementRenderContext
}) {
  const list = visibleMessagesSorted(ctx.messages).slice(0, el.maxItems ?? 6)
  const fs = el.fontSizeRem ?? 0.95
  const gap = el.gapRem ?? 0.35
  if (list.length === 0) {
    return (
      <div style={{ height: '100%', width: '100%', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: `clamp(0.5rem, ${fs}rem, 1rem)` }}>
        No visible messages
      </div>
    )
  }
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        padding: '0.35em 0.5em',
        display: 'flex',
        flexDirection: 'column',
        gap: `${gap}rem`,
        background: 'rgba(12,12,14,0.88)',
      }}
    >
      {list.map((m) => {
        const text = applyPlaceholders(m.text, {
          roomTitle: ctx.roomTitle,
          timerTitle: ctx.activeTimer?.title ?? undefined,
          speaker: ctx.activeTimer?.speaker ?? undefined,
        })
        return (
          <p
            key={m.id}
            style={{
              margin: 0,
              color: msgColor(m.color),
              fontSize: `clamp(0.5rem, ${fs}rem, 1.2rem)`,
              fontWeight: m.bold ? 700 : 400,
              lineHeight: 1.25,
              animation: m.flash ? 'cuepoint-pulse 1.2s ease-in-out infinite' : undefined,
            }}
          >
            {text}
          </p>
        )
      })}
    </div>
  )
}

function AgendaBlock({ el, ctx }: { el: Extract<OutputLayoutElement, { type: 'agenda' }>; ctx: ElementRenderContext }) {
  const list = sortedTimers(ctx.timers).slice(0, el.count ?? 6)
  const fs = el.fontSizeRem ?? 0.85
  const color = el.color ?? 'rgba(255,255,255,0.88)'
  const accent = el.accentColor ?? '#38bdf8'
  const showRem = el.showRemaining !== false

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'auto',
        padding: '0.35em 0.45em',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        background: 'rgba(0,0,0,0.45)',
        borderRadius: '0.25rem',
      }}
    >
      {list.map((t, i) => {
        const title = t.title?.trim() || `Timer ${i + 1}`
        const rem = showRem ? computeRemaining(t, { nowMs: ctx.nowMs, clockOffsetMs: ctx.clockOffsetMs }) : null
        const remLabel = rem != null && t.appearance !== 'HIDDEN' ? formatDuration(rem) : '—'
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', fontSize: `clamp(0.45rem, ${fs}rem, 1rem)`, color }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `3px solid ${accent}`, paddingLeft: '0.35em' }}>{title}</span>
            {showRem ? (
              <span style={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', opacity: 0.85, flexShrink: 0 }}>{remLabel}</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function LowerThirdBlock({
  el,
  ctx,
}: {
  el: Extract<OutputLayoutElement, { type: 'lower_third' }>
  ctx: ElementRenderContext
}) {
  const ph = {
    roomTitle: ctx.roomTitle,
    timerTitle: ctx.activeTimer?.title ?? undefined,
    speaker: ctx.activeTimer?.speaker ?? undefined,
  }
  const line1 = applyPlaceholders(el.line1, ph)
  const line2 = el.line2 ? applyPlaceholders(el.line2, ph) : ''
  const accent = el.accentColor ?? '#38bdf8'
  const align = el.align === 'center' ? 'center' : 'flex-start'
  const textAlign = el.align === 'center' ? 'center' : 'left'
  const fs = el.fontSizeRem ?? 1

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align,
        textAlign,
        padding: '0.4em 0.55em',
        background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 65%, transparent 100%)',
        color: '#fff',
      }}
    >
      <div style={{ width: '2.5rem', height: '0.2rem', background: accent, marginBottom: '0.25em', borderRadius: 2 }} />
      <div style={{ fontSize: `clamp(0.55rem, ${fs * 1.05}rem, 1.6rem)`, fontWeight: 700, lineHeight: 1.15 }}>{line1}</div>
      {line2 ? <div style={{ fontSize: `clamp(0.45rem, ${fs * 0.85}rem, 1.1rem)`, opacity: 0.75, marginTop: '0.15em' }}>{line2}</div> : null}
    </div>
  )
}

function QrBlock({ el }: { el: Extract<OutputLayoutElement, { type: 'qrcode' }> }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(el.data, {
      margin: el.margin ?? 1,
      width: 320,
      color: { dark: el.darkColor ?? '#000000', light: el.lightColor ?? '#ffffff' },
    }).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [el.data, el.margin, el.darkColor, el.lightColor])

  if (!src) {
    return <div style={{ height: '100%', width: '100%', background: 'rgba(255,255,255,0.06)' }} />
  }
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.15em' }}>
      <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  )
}
