import { useCallback, useRef } from 'react'
import type { OutputLayout, OutputLayoutElement } from '@cuepoint/shared'

type Box = OutputLayoutElement['box']

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

function clampBox(box: Box): Box {
  const w = clamp(box.w, 4, 100 - box.x)
  const h = clamp(box.h, 4, 100 - box.y)
  const x = clamp(box.x, 0, 100 - w)
  const y = clamp(box.y, 0, 100 - h)
  return { x, y, w, h }
}

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; startBox: Box }
  | { kind: 'resize'; id: string; startX: number; startY: number; startBox: Box }

export function LayoutEditorOverlays({
  layout,
  selectedId,
  onSelect,
  onBoxChange,
}: {
  layout: OutputLayout
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBoxChange: (elementId: string, box: Box) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current
      const d = dragRef.current
      if (!el || !d) return
      const r = el.getBoundingClientRect()
      const dx = ((clientX - d.startX) / r.width) * 100
      const dy = ((clientY - d.startY) / r.height) * 100
      let next: Box
      if (d.kind === 'move') {
        next = clampBox({
          x: d.startBox.x + dx,
          y: d.startBox.y + dy,
          w: d.startBox.w,
          h: d.startBox.h,
        })
      } else {
        next = clampBox({
          x: d.startBox.x,
          y: d.startBox.y,
          w: d.startBox.w + dx,
          h: d.startBox.h + dy,
        })
      }
      onBoxChange(d.id, next)
    },
    [onBoxChange]
  )

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[60]"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if (e.target === rootRef.current) onSelect(null)
      }}
    >
      {layout.elements.map((el, idx) => {
        const sel = el.id === selectedId
        return (
          <div
            key={el.id}
            className="absolute cursor-move rounded-sm border-2 border-dashed"
            style={{
              left: `${el.box.x}%`,
              top: `${el.box.y}%`,
              width: `${el.box.w}%`,
              height: `${el.box.h}%`,
              zIndex: 10 + idx,
              borderColor: sel ? 'rgba(59,130,246,0.95)' : 'rgba(148,163,184,0.55)',
              backgroundColor: sel ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              if ((e.target as HTMLElement).dataset['resize'] === '1') return
              e.stopPropagation()
              ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
              dragRef.current = {
                kind: 'move',
                id: el.id,
                startX: e.clientX,
                startY: e.clientY,
                startBox: { ...el.box },
              }
              onSelect(el.id)
            }}
            onPointerMove={(e) => {
              if (dragRef.current?.id !== el.id || dragRef.current.kind !== 'move') return
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
              applyDrag(e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
              e.currentTarget.releasePointerCapture(e.pointerId)
              dragRef.current = null
            }}
            onPointerCancel={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId)
              }
              dragRef.current = null
            }}
          >
            <div
              data-resize="1"
              className="absolute bottom-0.5 right-0.5 h-3 w-3 cursor-nwse-resize rounded-sm bg-blue-500/90 border border-white/80"
              onPointerDown={(e) => {
                e.stopPropagation()
                if (e.button !== 0) return
                ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                dragRef.current = {
                  kind: 'resize',
                  id: el.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  startBox: { ...el.box },
                }
                onSelect(el.id)
              }}
              onPointerMove={(e) => {
                if (dragRef.current?.id !== el.id || dragRef.current.kind !== 'resize') return
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
                applyDrag(e.clientX, e.clientY)
              }}
              onPointerUp={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
                e.currentTarget.releasePointerCapture(e.pointerId)
                dragRef.current = null
              }}
              onPointerCancel={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
                dragRef.current = null
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
