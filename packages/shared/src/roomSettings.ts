export type ViewerAccessMode = 'open' | 'output_link_only'

export function getViewerAccess(settings: unknown): ViewerAccessMode {
  if (settings && typeof settings === 'object' && 'viewerAccess' in settings) {
    const v = (settings as { viewerAccess?: unknown }).viewerAccess
    if (v === 'output_link_only') return 'output_link_only'
  }
  return 'open'
}
