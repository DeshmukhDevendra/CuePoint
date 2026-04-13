import { useEffect, type CSSProperties, type ReactNode } from 'react'
import type { Message, Timer } from '@cuepoint/db'
import type { OutputLayout, OutputLayoutElement } from '@cuepoint/shared'
import { renderLayoutElement, type ElementRenderContext } from './CustomOutputElements.js'

function aspectRatioParts(aspect: OutputLayout['aspect']): { rw: number; rh: number } {
  switch (aspect) {
    case '9:16':
      return { rw: 9, rh: 16 }
    case '4:3':
      return { rw: 4, rh: 3 }
    case '1:1':
      return { rw: 1, rh: 1 }
    default:
      return { rw: 16, rh: 9 }
  }
}

function BoxFrame({
  box,
  children,
  zIndex = 1,
}: {
  box: OutputLayoutElement['box']
  children: ReactNode
  zIndex?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        zIndex,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}

export type CustomOutputStageProps = {
  layout: OutputLayout
  roomTitle: string
  timers: Timer[]
  messages: Message[]
  nowMs: number
  clockOffsetMs: number
  variant?: 'fullscreen' | 'embedded'
  logoUrl?: string | null
  logoMode?: string | null
}

export function CustomOutputStage({
  layout,
  roomTitle,
  timers,
  messages,
  nowMs,
  clockOffsetMs,
  variant = 'fullscreen',
  logoUrl,
  logoMode,
}: CustomOutputStageProps) {
  const { rw, rh } = aspectRatioParts(layout.aspect)
  const outer: CSSProperties =
    variant === 'embedded'
      ? {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          fontFamily: layout.fontFamily,
        }
      : {
          position: 'relative',
          width: `min(100vw, calc(100vh * ${rw} / ${rh}))`,
          height: `min(100vh, calc(100vw * ${rh} / ${rw}))`,
          margin: 'auto',
          fontFamily: layout.fontFamily,
        }

  const showLogo =
    Boolean(logoUrl) && logoMode !== 'HIDDEN' && (logoMode === 'CUSTOM' || logoMode === 'DEFAULT')

  const active = timers.find((t) => t.isRunning) ?? timers[0] ?? null
  const fontHref = layout.fontCssUrl?.trim() || ''
  const bgImg = layout.backgroundImageUrl?.trim() || ''
  const bgFit = layout.backgroundImageFit ?? 'cover'

  useEffect(() => {
    if (!fontHref) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = fontHref
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [fontHref])

  const ctx: ElementRenderContext = {
    roomTitle,
    timers,
    messages,
    nowMs,
    clockOffsetMs,
    activeTimer: active,
  }

  return (
    <>
      <style>{`@keyframes cuepoint-pulse{0%,100%{opacity:1}50%{opacity:0.55}}`}</style>
      <div style={outer}>
        {bgImg ? (
          <img
            src={bgImg}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: bgFit,
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: layout.background,
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {layout.elements.map((el, i) => (
            <BoxFrame key={el.id} box={el.box} zIndex={3 + i}>
              {renderLayoutElement(el, ctx)}
            </BoxFrame>
          ))}
        </div>
        {showLogo ? (
          <img
            src={logoUrl!}
            alt=""
            style={{
              position: 'absolute',
              top: '2%',
              right: '2%',
              maxWidth: '18%',
              maxHeight: '12%',
              objectFit: 'contain',
              zIndex: 50,
              pointerEvents: 'none',
            }}
          />
        ) : null}
      </div>
    </>
  )
}
