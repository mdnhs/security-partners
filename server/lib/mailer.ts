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
 * behind the same `send` signature. Never throws (a failure is
 * `{ delivered: false }`) and never logs message bodies or error messages:
 * they can contain single-use links.
 */
export const mailer = {
  async send({ to, subject, react }: MailMessage): Promise<SendResult> {
    try {
      await render(react)
    } catch (err) {
      console.error(
        `[mailer] could not render "${subject}" to ${to} (${err instanceof Error ? err.name : "unknown error"})`
      )
      return { delivered: false }
    }
    console.info(
      `[mailer] SMTP is not configured; not sent: "${subject}" to ${to}`
    )
    return { delivered: false }
  },
}
