import { z } from 'zod'
import { OutputLayoutSchema } from './customOutputLayout.js'

// ============================================================
// Auth
// ============================================================

export const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
})
export type SignupInput = z.infer<typeof SignupSchema>

export const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
})
export type LoginInput = z.infer<typeof LoginSchema>

// ============================================================
// Rooms
// ============================================================

export const CreateRoomSchema = z.object({
  title: z.string().min(1).max(200).default('Untitled Room'),
  timezone: z.string().min(1).max(64).default('UTC'),
  teamId: z.string().cuid().optional(),
})
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>

export const UpdateRoomSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(64).optional(),
  onAir: z.boolean().optional(),
  blackout: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
})
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>

/** Controller + guest: on-air, blackout, viewer access (no auth user required). */
export const UpdateRoomLiveSchema = z.object({
  onAir: z.boolean().optional(),
  blackout: z.boolean().optional(),
  viewerAccess: z.enum(['open', 'output_link_only']).optional(),
})
export type UpdateRoomLiveInput = z.infer<typeof UpdateRoomLiveSchema>

/** Query param on GET /public/rooms/:id — controls output-link-only gate. */
export const PublicRoomForQuerySchema = z.enum(['viewer', 'agenda', 'moderator', 'operator'])
export type PublicRoomForQuery = z.infer<typeof PublicRoomForQuerySchema>

export const CreateAnonymousRoomSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(64).default('UTC'),
})
export type CreateAnonymousRoomInput = z.infer<typeof CreateAnonymousRoomSchema>

export const ClaimRoomSchema = z.object({
  controllerToken: z.string().min(16).max(512),
})
export type ClaimRoomInput = z.infer<typeof ClaimRoomSchema>

// ============================================================
// Timers
// ============================================================

export const TimerAppearanceSchema = z.enum([
  'COUNTDOWN',
  'COUNT_UP',
  'TIME_OF_DAY',
  'COUNTDOWN_TOD',
  'COUNT_UP_TOD',
  'HIDDEN',
])

export const TimerTriggerSchema = z.enum(['MANUAL', 'LINKED', 'SCHEDULED'])

export const CreateTimerSchema = z.object({
  roomId: z.string().cuid(),
  title: z.string().max(200).optional(),
  speaker: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  /** Time Warp: audience-facing display duration. null = no warp. */
  displayMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).nullable().optional(),
  order: z.number().int().min(0).optional(),
  triggerType: TimerTriggerSchema.default('MANUAL'),
  appearance: TimerAppearanceSchema.default('COUNTDOWN'),
  startTime: z.string().datetime().optional().nullable(),
  wrapupYellowMs: z.number().int().min(0).optional(),
  wrapupRedMs: z.number().int().min(0).optional(),
  wrapupFlash: z.boolean().optional(),
  wrapupChime: z.string().url().max(2048).nullable().optional(),
  labelIds: z.array(z.string().cuid()).default([]),
})
export type CreateTimerInput = z.infer<typeof CreateTimerSchema>

export const UpdateTimerSchema = CreateTimerSchema.partial().omit({ roomId: true })
export type UpdateTimerInput = z.infer<typeof UpdateTimerSchema>

export const TimerActionSchema = z.object({
  action: z.enum(['start', 'stop', 'pause', 'resume', 'reset', 'adjust', 'expire']),
  adjustMs: z.number().int().optional(), // used by "adjust"
})
export type TimerAction = z.infer<typeof TimerActionSchema>

export const ReorderTimersSchema = z.object({
  roomId: z.string().cuid(),
  orderedIds: z.array(z.string().cuid()),
})
export type ReorderTimersInput = z.infer<typeof ReorderTimersSchema>

// ============================================================
// Messages
// ============================================================

export const CreateMessageSchema = z.object({
  roomId: z.string().cuid(),
  text: z.string().min(1).max(1000),
  color: z.string().max(32).default('white'),
  bold: z.boolean().default(false),
  uppercase: z.boolean().default(false),
  flash: z.boolean().default(false),
})
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>

export const UpdateMessageSchema = CreateMessageSchema.partial().omit({ roomId: true }).extend({
  focus: z.boolean().optional(),
  visible: z.boolean().optional(),
})
export type UpdateMessageInput = z.infer<typeof UpdateMessageSchema>

export const ReorderMessagesSchema = z.object({
  roomId: z.string().cuid(),
  orderedIds: z.array(z.string().cuid()),
})
export type ReorderMessagesInput = z.infer<typeof ReorderMessagesSchema>

// ============================================================
// Submit Question (audience)
// ============================================================

export const SubmitQuestionSchema = z.object({
  roomId: z.string().cuid(),
  text: z.string().min(1).max(500),
  name: z.string().max(100).optional(),
})
export type SubmitQuestionInput = z.infer<typeof SubmitQuestionSchema>

/** Public submit-question body (roomId comes from URL). */
export const SubmitQuestionBodySchema = SubmitQuestionSchema.omit({ roomId: true })
export type SubmitQuestionBodyInput = z.infer<typeof SubmitQuestionBodySchema>

export const UpdateSubmitQuestionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  closedMessage: z.string().max(500).optional().nullable(),
  logoUrl: z.union([z.string().url().max(2048), z.literal('')]).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  subtitle: z.string().max(500).optional().nullable(),
  questionLabel: z.string().max(120).optional().nullable(),
  nameLabel: z.string().max(120).optional().nullable(),
  hideName: z.boolean().optional(),
})
export type UpdateSubmitQuestionConfigInput = z.infer<typeof UpdateSubmitQuestionConfigSchema>

// ============================================================
// Teams
// ============================================================

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
})
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export const TeamRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER'])

export const InviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role: TeamRoleSchema.default('MEMBER'),
})
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>

export const UpdateMemberRoleSchema = z.object({
  role: TeamRoleSchema,
})

export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
})

// ============================================================
// Outputs & signed viewer links (Phase 3)
// ============================================================

export const OutputTypeSchema = z.enum(['VIEWER', 'AGENDA', 'MODERATOR', 'CONTROLLER', 'OPERATOR', 'CUSTOM'])
export type OutputTypeInput = z.infer<typeof OutputTypeSchema>

export const CreateOutputSchema = z.object({
  name: z.string().min(1).max(120),
  type: OutputTypeSchema.default('VIEWER'),
})
export type CreateOutputInput = z.infer<typeof CreateOutputSchema>

export const OutputLinkOptionsSchema = z
  .object({
    identifier: z.string().max(100).optional(),
    mirror: z.boolean().optional(),
    delaySec: z.number().int().min(0).max(86_400).optional(),
    timezone: z.string().max(64).optional(),
    hideControls: z.boolean().optional(),
  })
  .strict()
  .default({})

export const CreateOutputLinkSchema = z.object({
  options: OutputLinkOptionsSchema.optional(),
})
export type CreateOutputLinkInput = z.infer<typeof CreateOutputLinkSchema>

export const UnlockOutputLinkBodySchema = z
  .object({
    signature: z.string().min(1).optional(),
    shortCode: z.string().min(1).max(32).optional(),
    password: z.string().min(1).max(200),
  })
  .refine((b) => Number(!!b.signature) + Number(!!b.shortCode) === 1, {
    message: 'Provide exactly one of signature or shortCode',
  })
export type UnlockOutputLinkBodyInput = z.infer<typeof UnlockOutputLinkBodySchema>

export const OutputLogoModeSchema = z.enum(['DEFAULT', 'HIDDEN', 'CUSTOM'])

export const UpdateOutputBodySchema = z.object({
  password: z.union([z.string().min(1).max(200), z.null()]).optional(),
  name: z.string().min(1).max(120).optional(),
  layout: OutputLayoutSchema.optional(),
  logoUrl: z.union([z.string().url().max(2048), z.literal(''), z.null()]).optional(),
  logoMode: OutputLogoModeSchema.optional(),
})
export type UpdateOutputBodyInput = z.infer<typeof UpdateOutputBodySchema>

export const ImportOutputLayoutBodySchema = z.object({
  fromOutputId: z.string().cuid(),
})
export type ImportOutputLayoutBodyInput = z.infer<typeof ImportOutputLayoutBodySchema>

/** Logged-in room owner: copy layout from an output in another room they own. */
export const ImportOutputLayoutRemoteBodySchema = z.object({
  sourceRoomId: z.string().cuid(),
  sourceOutputId: z.string().cuid(),
})
export type ImportOutputLayoutRemoteBodyInput = z.infer<typeof ImportOutputLayoutRemoteBodySchema>
