import { useState } from 'react'
import { useRoomStore, type RoomWithRelations } from '@/hooks/useRoom'
import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'
import { getViewerAccess, type ViewerAccessMode } from '@cuepoint/shared'
import { roomControlInit } from '@/lib/controllerToken'

export function RoomLiveCard({
  roomId,
  room,
  canMutate,
}: {
  roomId: string
  room: RoomWithRelations
  canMutate: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const liveConnectionCount = useRoomStore((s) => s.liveConnectionCount)
  const viewerAccess: ViewerAccessMode = getViewerAccess(room.settings)

  async function patch(body: Record<string, unknown>) {
    if (!canMutate) return
    setBusy(true)
    setMsg(null)
    try {
      await api.patch(`/rooms/${roomId}/live`, body, roomControlInit(roomId))
    } catch {
      setMsg('Could not update.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Live output</h2>
        <p className="text-xs text-muted-foreground mt-0.5">On-air, blackout, and who can open the room-id viewer.</p>
      </div>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      {liveConnectionCount != null && (
        <p className="text-sm text-muted-foreground">
          Live connections (Socket.IO room): <span className="font-mono text-foreground">{liveConnectionCount}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={room.onAir}
            disabled={!canMutate || busy}
            onChange={(e) => void patch({ onAir: e.target.checked })}
          />
          On air
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={room.blackout}
            disabled={!canMutate || busy}
            onChange={(e) => void patch({ blackout: e.target.checked })}
          />
          Blackout (viewer)
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Room-id viewer access</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={cnBtn(viewerAccess === 'open')}
            disabled={!canMutate || busy}
            onClick={() => void patch({ viewerAccess: 'open' })}
          >
            Open (default)
          </Button>
          <Button
            type="button"
            className={cnBtn(viewerAccess === 'output_link_only')}
            disabled={!canMutate || busy}
            onClick={() => void patch({ viewerAccess: 'output_link_only' })}
          >
            Output link only
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          When set to output link only, <code className="text-[10px]">/rooms/…/viewer</code> is blocked; agenda and
          moderator URLs still work. Use a generated output link for the main viewer.
        </p>
      </div>
    </Card>
  )
}

function cnBtn(active: boolean) {
  return active
    ? 'h-8 text-xs px-3 bg-primary text-primary-foreground'
    : 'h-8 text-xs px-3 bg-muted text-foreground'
}
