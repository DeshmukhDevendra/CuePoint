/** Standard room graph for Socket.IO + public HTTP snapshots. */
export const roomInclude = {
  timers: { orderBy: { order: 'asc' as const } },
  messages: { orderBy: { order: 'asc' as const } },
  labels: true,
  submitConfig: true,
} as const
