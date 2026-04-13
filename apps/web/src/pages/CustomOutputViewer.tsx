import { useEffect, useMemo, useState } from 'react'
import { CustomOutputStage } from '@cuepoint/output-elements'
import { parseOutputLayoutOrDefault, type ParsedOutputLinkOptions, type OutputBlackoutStyle } from '@cuepoint/shared'
import type { RoomWithRelations } from '@/hooks/useRoom'
import { getClockOffset } from '@/hooks/useSocket'
import { ViewerShell } from '@/pages/ViewerPage'

export function CustomOutputViewer({
  room,
  layout: layoutRaw,
  linkOptions,
  liveConnectionCount,
  logoUrl,
  logoMode,
}: {
  room: RoomWithRelations
  layout: unknown
  linkOptions?: ParsedOutputLinkOptions
  liveConnectionCount?: number | null
  logoUrl?: string | null
  logoMode?: string | null
}) {
  const layout = useMemo(() => parseOutputLayoutOrDefault(layoutRaw), [layoutRaw])
  const blackoutMode: OutputBlackoutStyle = layout.blackoutStyle ?? 'fullscreen'
  const hideChrome = linkOptions?.hideControls === true
  const mirror = linkOptions?.mirror === true
  const delaySec = linkOptions?.delaySec ?? 0

  const [, tick] = useState(0)
  useEffect(() => {
    let id = 0
    const loop = () => {
      tick((x) => (x + 1) % 1_000_000)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [delaySec])

  const delayMs = delaySec * 1000
  const nowMs = Date.now()
  const clockOffsetMs = getClockOffset() - delayMs

  return (
    <ViewerShell
      room={room}
      linkOptions={linkOptions}
      liveConnectionCount={liveConnectionCount}
      mirror={mirror}
      hideChrome={hideChrome}
      blackoutMode={blackoutMode}
    >
      <div className="flex flex-1 min-h-0 items-center justify-center bg-black">
        <CustomOutputStage
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
    </ViewerShell>
  )
}
