/**
 * Plan limit definitions.
 * -1 means unlimited.
 */
export type PlanTier = 'FREE' | 'PRO' | 'PREMIUM'

export interface PlanLimits {
  /** Max rooms owned by this team (or personal rooms for a solo user) */
  rooms: number
  /** Max timers per room */
  timersPerRoom: number
  /** Max team members (including owner) */
  teamMembers: number
  /** Max active output links per room */
  outputLinks: number
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: {
    rooms: 5,
    timersPerRoom: 20,
    teamMembers: 3,
    outputLinks: 3,
  },
  PRO: {
    rooms: 50,
    timersPerRoom: 100,
    teamMembers: 25,
    outputLinks: 20,
  },
  PREMIUM: {
    rooms: -1,
    timersPerRoom: -1,
    teamMembers: -1,
    outputLinks: -1,
  },
}

export function getPlanLimits(plan: PlanTier): PlanLimits {
  return PLAN_LIMITS[plan]
}

export function isUnlimited(n: number): boolean {
  return n === -1
}

export function withinLimit(current: number, limit: number): boolean {
  return limit === -1 || current < limit
}

export const PLAN_DISPLAY_NAMES: Record<PlanTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
}

export const PLAN_DESCRIPTIONS: Record<PlanTier, string> = {
  FREE: 'Up to 5 rooms, 20 timers/room, 3 team members',
  PRO: 'Up to 50 rooms, 100 timers/room, 25 team members',
  PREMIUM: 'Unlimited rooms, timers, and members',
}
