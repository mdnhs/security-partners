import "server-only"

import type { ReactElement } from "react"
import { render } from "react-email"

export type MailMessage = { to: string; subject: string; react: ReactElement }
export type SendResult = { delivered: boolean; previewUrl?: string }

/**
 * Transactional email. Phase 2: no transport is configured yet, so every
 * message is rendered (catching template errors early) and reported as not
 * delivered; callers then surface a copyable link instead (invites, owner
 * recovery). Task 7.2 adds the SMTP transport from `integrations.smtp`
 * behind the same `send` signature. Never logs message bodies: they contain
 * single-use links.
 */
export const mailer = {
  async send({ to, subject, react }: MailMessage): Promise<SendResult> {
    await render(react)
    console.info(
      `[mailer] SMTP is not configured; not sent: "${subject}" to ${to}`
    )
    return { delivered: false }
  },
}
