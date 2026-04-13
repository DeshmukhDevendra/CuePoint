import { useEffect, useMemo, useState } from 'react'
import { CustomOutputStage } from '@cuepoint/output-elements'
import type { OutputLayout } from '@cuepoint/shared'
import type { RoomWithRelations } from '@/hooks/useRoom'
import { getClockOffset } from '@/hooks/useSocket'
import { LayoutEditorOverlays } from '@/components/LayoutEditorOverlays'

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

type EditOverlay = {
  selectedId: string | null
  onSelect: (id: string | null) => void
  onBoxChange: (elementId: string, box: OutputLayout['elements'][0]['box']) => void
}

/** Live preview of a custom layout against the current room snapshot (editor page). */
export function CustomOutputEditorPreview({
  room,
  layout,
  logoUrl,
  logoMode,
  editOverlay,
}: {
  room: RoomWithRelations
  layout: OutputLayout | null
  logoUrl?: string | null
  logoMode?: string | null
  editOverlay?: EditOverlay
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    let id = 0
    const loop = () => {
      tick((x) => (x + 1) % 1_000_000)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  const { rw, rh } = useMemo(
    () => (layout ? aspectRatioParts(layout.aspect) : { rw: 16, rh: 9 }),
    [layout]
  )

  if (!layout) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Fix JSON until the layout validates — preview appears here.
      </p>
    )
  }

  const nowMs = Date.now()
  const clockOffsetMs = getClockOffset()

  return (
    <div
      className="relative w-full mx-auto rounded-lg border border-border bg-black overflow-hidden"
      style={{ aspectRatio: `${rw} / ${rh}`, maxHeight: 'min(65vh, 560px)' }}
    >
      <div className="absolute inset-0">
        <CustomOutputStage
          variant="embedded"
          layout={layout}
          roomTitle={room.title}
          timers={room.timers}
          messages={room.messages}
          nowMs={nowMs}
          clockOffsetMs={clockOffsetMs}
          logoUrl={logoUrl}
          logoMode={logoMode}
        />
      </div>
      {editOverlay ? (
        <LayoutEditorOverlays
          layout={layout}
          selectedId={editOverlay.selectedId}
          onSelect={editOverlay.onSelect}
          onBoxChange={editOverlay.onBoxChange}
        />
      ) : null}
    </div>
  )
}
