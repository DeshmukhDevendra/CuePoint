/**
 * Email delivery via Resend.
 * Gracefully no-ops when RESEND_API_KEY is absent (dev / CI).
 */
import { Resend } from 'resend'
import { env } from '../env.js'
import { logger } from '../logger.js'

/** Escape user-supplied strings before embedding in HTML to prevent XSS. */
function he(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null
  if (!resend) resend = new Resend(env.RESEND_API_KEY)
  return resend
}

export interface InviteEmailPayload {
  to: string
  teamName: string
  inviterName: string
  inviteUrl: string
  role: string
  expiresAt: Date
}

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<boolean> {
  const client = getResend()

  if (!client) {
    logger.info({ to: payload.to }, 'email: RESEND_API_KEY not set, skipping invite email')
    return false
  }

  const expiryStr = payload.expiresAt.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const roleLabel = payload.role.charAt(0) + payload.role.slice(1).toLowerCase()

  try {
    const { error } = await client.emails.send({
      from: env.RESEND_FROM ?? 'invites@cuepoint.app',
      to: payload.to,
      subject: `${payload.inviterName} invited you to join ${payload.teamName} on CuePoint`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:40px 20px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="width:40px;height:40px;background:#2563eb;border-radius:8px;margin-bottom:24px"></div>
    <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 8px">You&#x27;re invited to ${he(payload.teamName)}</h1>
    <p style="color:#6b7280;font-size:15px;margin:0 0 24px">
      <strong>${he(payload.inviterName)}</strong> has invited you to join <strong>${he(payload.teamName)}</strong> as a <strong>${he(roleLabel)}</strong> on CuePoint.
    </p>
    <a href="${he(payload.inviteUrl)}"
       style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px">
      Accept invitation
    </a>
    <p style="color:#9ca3af;font-size:13px;margin:24px 0 0">
      This invitation expires on ${he(expiryStr)}. If you weren&#x27;t expecting this, you can ignore this email.
    </p>
    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
    <p style="color:#9ca3af;font-size:12px;margin:0">
      CuePoint · Realtime live event timing
    </p>
  </div>
</body>
</html>`,
      text: `${payload.inviterName} invited you to join ${payload.teamName} on CuePoint as a ${roleLabel}.\n\nAccept invitation: ${payload.inviteUrl}\n\nThis invite expires on ${expiryStr}.`,
    })

    if (error) {
      logger.error({ error, to: payload.to }, 'email: resend returned error')
      return false
    }

    logger.info({ to: payload.to, team: payload.teamName }, 'email: invite sent')
    return true
  } catch (err) {
    logger.error({ err, to: payload.to }, 'email: failed to send invite')
    return false
  }
}
