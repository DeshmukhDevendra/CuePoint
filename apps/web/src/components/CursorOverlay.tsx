import type { RemoteCursor } from '@/hooks/useCursors'

/**
 * Renders remote collaborator cursors as floating labels.
 * Positioned fixed so it overlays the whole viewport regardless of scroll.
 */
export function CursorOverlay({ cursors }: { cursors: RemoteCursor[] }) {
  if (cursors.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {cursors.map((c) => (
        <div
          key={c.userId}
          className="absolute flex items-center gap-1 transition-transform duration-75"
          style={{
            left: `${c.x * 100}%`,
            top: `${c.y * 100}%`,
            transform: 'translate(8px, 8px)',
          }}
        >
          {/* Arrow */}
          <svg width="12" height="16" viewBox="0 0 12 16" fill={c.color} className="shrink-0 drop-shadow">
            <path d="M0 0 L12 10 L6.5 10 L4 16 L0 0Z" />
          </svg>
          {/* Name tag */}
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white shadow-md whitespace-nowrap"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  )
}
