import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useOutputLinkViewer, useRoomStore } from '@/hooks/useRoom'
import { OutputLinkUnlockForm } from '@/components/OutputLinkUnlockForm'
import { CustomOutputViewer } from '@/pages/CustomOutputViewer'
import { ViewerLayout } from '@/pages/ViewerPage'

export function OutputLinkViewerPage() {
  const { signature, shortCode } = useParams<{ signature?: string; shortCode?: string }>()
  const { room, loading, passwordRequired, linkOptions, outputMeta, retryAfterUnlock } = useOutputLinkViewer({
    signature,
    shortCode,
  })
  const liveConnectionCount = useRoomStore((s) => s.liveConnectionCount)

  useEffect(() => {
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  if (passwordRequired && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4 py-10">
        <OutputLinkUnlockForm
          signature={signature}
          shortCode={shortCode}
          onUnlocked={() => retryAfterUnlock()}
        />
      </div>
    )
  }

  if (loading || !room) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white text-2xl">
        {loading ? 'Connecting…' : 'Invalid or expired link.'}
      </div>
    )
  }

  if (outputMeta?.type === 'CUSTOM') {
    return (
      <CustomOutputViewer
        room={room}
        layout={outputMeta.layout}
        linkOptions={linkOptions}
        liveConnectionCount={liveConnectionCount}
        logoUrl={outputMeta.logoUrl}
        logoMode={outputMeta.logoMode}
      />
    )
  }

  return <ViewerLayout room={room} linkOptions={linkOptions} liveConnectionCount={liveConnectionCount} />
}
