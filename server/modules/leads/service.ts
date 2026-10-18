import "server-only"

import { createElement } from "react"

import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement"
import { LeadNotificationEmail } from "@/emails/lead-notification"
import type { TurnstileConfig } from "@/lib/schemas/integrations"
import type { LeadPublicConfig, LeadSubmission } from "@/lib/schemas/api/leads"
import { formatDateTime } from "@/lib/format"
import { interpolate } from "@/lib/interpolate"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { writeAudit } from "@/server/lib/audit"
import { AppError } from "@/server/lib/errors"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { verifyTurnstileToken } from "@/server/lib/turnstile"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { getPublishedSettings } from "@/server/modules/settings/service"

import * as repo from "./repo"

const DEFAULT_SUBJECT = "Website enquiry from {name}"
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`
const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"

async function readTurnstile(): Promise<TurnstileConfig | null | "unreadable"> {
  try {
    return await readIntegrationConfig("integrations.turnstile")
  } catch (err) {
    console.error(
      `[leads] Turnstile settings could not be read (${errorName(err)})`
    )
    return "unreadable"
  }
}

/** Site key for the invisible widget, only while spam protection is on. */
export async function publicFormConfig(): Promise<LeadPublicConfig> {
  const config = await readTurnstile()
  if (config === "unreadable" || !config?.enabled || !config.siteKey)
    return { turnstileSiteKey: null }
  return { turnstileSiteKey: config.siteKey }
}

async function assertHuman(token: string | undefined, ip: string | null) {
  const config = await readTurnstile()
  // Unreadable settings must not lose real enquiries: skip, logged above.
  if (config === "unreadable" || !config?.enabled) return
  if (await verifyTurnstileToken({ secret: config.secretKey, token, ip }))
    return
  throw new AppError("VALIDATION_FAILED", "Spam check failed", {
    fieldErrors: {
      turnstileToken: ["Spam check failed. Reload the page and try again."],
    },
  })
}

/**
 * Public contact form (spec §9). Honeypot submissions look successful but
 * store nothing. Emails run after the commit and never fail the request.
 */
export async function submitLead(
  input: LeadSubmission,
  meta: { ip: string | null }
): Promise<{ ok: true; leadId: string | null }> {
  if (input.website && input.website.trim() !== "") {
    console.info("[leads] honeypot filled; submission dropped")
    return { ok: true, leadId: null }
  }
  await assertHuman(input.turnstileToken, meta.ip)
  const lead = await getDb().transaction(async (tx) => {
    const row = await repo.insertLead(tx, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      service: input.service,
      message: input.message,
      consent: input.consent,
      sourcePage: input.sourcePage ?? null,
      ipHash: meta.ip ? hashIp(meta.ip) : null,
    })
    await repo.insertLeadEvent(tx, {
      leadId: row.id,
      type: "created",
      body: input.sourcePage
        ? `Sent from ${input.sourcePage}`
        : "Sent from the website",
      actorId: null,
    })
    await writeAudit(tx, null, {
      action: "lead.created",
      entityType: "lead",
      entityId: row.id,
    })
    return row
  })
  try {
    await notifyNewLead(lead)
  } catch (err) {
    console.error(`[leads] notification step failed (${errorName(err)})`)
  }
  return { ok: true, leadId: lead.id }
}

async function notifyNewLead(lead: repo.LeadRow): Promise<void> {
  const db = getDb()
  const [leadsSettings, site, contact, contactSection] = await Promise.all([
    getPublishedSettings("leads", db),
    getPublishedSettings("site", db),
    getPublishedSettings("contact", db),
    getPublishedSettings("sections.contact", db),
  ])
  const siteName = site?.name ?? "Security Partners"
  const outcomes: string[] = []

  const recipients = leadsSettings?.recipients ?? []
  if (recipients.length === 0) {
    outcomes.push(
      "Staff notification not sent: no recipients in Settings ▸ Leads."
    )
  } else {
    const { delivered } = await mailer.send({
      to: recipients,
      replyTo: lead.email,
      template: "lead-notification",
      subject: interpolate(
        contactSection?.form.mailtoSubject ?? DEFAULT_SUBJECT,
        { name: lead.name }
      ),
      react: createElement(LeadNotificationEmail, {
        siteName,
        adminUrl: new URL(
          `/admin/leads/${lead.id}`,
          getEnv().BETTER_AUTH_URL
        ).toString(),
        lead: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          service: lead.service,
          message: lead.message,
          sourcePage: lead.sourcePage,
          receivedAt: formatDateTime(lead.createdAt),
        },
      }),
    })
    outcomes.push(
      delivered
        ? `Staff notification sent to ${plural(recipients.length, "recipient")}.`
        : "Staff notification not sent: email is not configured or failed."
    )
  }

  if (leadsSettings?.acknowledgement) {
    const { delivered } = await mailer.send({
      to: lead.email,
      template: "lead-acknowledgement",
      subject: `We received your message – ${siteName}`,
      react: createElement(LeadAcknowledgementEmail, {
        name: lead.name,
        siteName,
        message: lead.message,
        phone24h: contact?.phone24h ?? null,
      }),
    })
    outcomes.push(
      delivered
        ? "Acknowledgement sent to the visitor."
        : "Acknowledgement not sent: email is not configured or failed."
    )
  }

  for (const body of outcomes)
    await repo.insertLeadEvent(db, {
      leadId: lead.id,
      type: "email",
      body,
      actorId: null,
    })
}
