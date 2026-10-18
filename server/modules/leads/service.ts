import "server-only"

import { createElement } from "react"

import { LeadAcknowledgementEmail } from "@/emails/lead-acknowledgement"
import { LeadNotificationEmail } from "@/emails/lead-notification"
import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
} from "@/lib/auth/permissions"
import { CSV_BOM, toCsv } from "@/lib/csv"
import type { TurnstileConfig } from "@/lib/schemas/integrations"
import {
  LEAD_CSV_HEADER,
  LEAD_EXPORT_LIMIT,
  LEAD_STATUS_LABELS,
  type LeadAssignee,
  type LeadBadge,
  type LeadDto,
  type LeadEventType,
  type LeadExportQuery,
  type LeadListItem,
  type LeadListQuery,
  type LeadPublicConfig,
  type LeadStatus,
  type LeadSubmission,
  type UpdateLeadInput,
} from "@/lib/schemas/api/leads"
import type { Paginated } from "@/lib/schemas/api/list"
import { formatDateTime, isoDate } from "@/lib/format"
import { interpolate } from "@/lib/interpolate"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { verifyTurnstileToken } from "@/server/lib/turnstile"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { deleteExpiredRateLimits } from "@/server/modules/rate-limit/repo"
import { readPublishedSettings } from "@/server/modules/settings/service"

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

/**
 * Turnstile check. true = enabled and verified for this request; false =
 * not enabled (or unreadable: real enquiries must not be lost, logged
 * above). Throws 422 when enabled and the token fails.
 */
async function assertHuman(
  token: string | undefined,
  ip: string | null
): Promise<boolean> {
  const config = await readTurnstile()
  if (config === "unreadable" || !config?.enabled) return false
  if (await verifyTurnstileToken({ secret: config.secretKey, token, ip }))
    return true
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
  // Turnstile first: with it on, a bot without a token gets 422 whether
  // or not it filled the honeypot.
  const humanVerified = await assertHuman(input.turnstileToken, meta.ip)
  if (honeypotFilled(input.website)) {
    console.info("[leads] honeypot filled; submission dropped")
    return { ok: true, leadId: null }
  }
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
    await notifyNewLead(lead, { humanVerified })
  } catch (err) {
    console.error(`[leads] notification step failed (${errorName(err)})`)
  }
  return { ok: true, leadId: lead.id }
}

/** Any value except undefined, null or a blank string fires the honeypot. */
function honeypotFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  return typeof value !== "string" || value.trim() !== ""
}

async function notifyNewLead(
  lead: repo.LeadRow,
  { humanVerified }: { humanVerified: boolean }
): Promise<void> {
  const db = getDb()
  const [leadsSettings, site, contact, contactSection] = await Promise.all([
    readPublishedSettings("leads", db),
    readPublishedSettings("site", db),
    readPublishedSettings("contact", db),
    readPublishedSettings("sections.contact", db),
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

  // Without a verified human check the acknowledgement would let anyone
  // send our email to any address (relay): owner ruling, Turnstile required.
  if (leadsSettings?.acknowledgement && !humanVerified) {
    outcomes.push("Acknowledgement skipped (no Turnstile).")
  } else if (leadsSettings?.acknowledgement) {
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

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

const canWorkLeads = (role: string | null, banned: boolean | null) =>
  !banned && hasPermission(parseRoles(role), { lead: ["update"] })

function toListItem(row: repo.LeadWithAssignee): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    status: row.status,
    assignee: row.assigneeId
      ? { id: row.assigneeId, name: row.assigneeName ?? "Deleted user" }
      : null,
    sourcePage: row.sourcePage,
    createdAt: row.createdAt.toISOString(),
  }
}

function filtersFrom(
  actor: Actor,
  q: Pick<
    LeadExportQuery,
    "q" | "status" | "assignee" | "from" | "to" | "email"
  >
): repo.LeadFilters {
  return {
    status: q.status,
    assigneeId: q.assignee === "me" ? actor.userId : q.assignee,
    q: q.q || undefined,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
    email: q.email,
  }
}

export async function listLeads(
  actor: Actor,
  query: LeadListQuery
): Promise<Paginated<LeadListItem>> {
  assertCan(actor, { lead: ["read"] })
  const { rows, total } = await repo.listLeadRows(getDb(), {
    filters: filtersFrom(actor, query),
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getLead(actor: Actor, id: string): Promise<LeadDto> {
  assertCan(actor, { lead: ["read"] })
  const db = getDb()
  const row = await repo.findLeadRow(db, id)
  if (!row) throw notFound("Lead")
  const events = await repo.listLeadEventRows(db, id)
  return {
    ...toListItem(row),
    service: row.service,
    message: row.message,
    consent: row.consent,
    updatedAt: row.updatedAt.toISOString(),
    events: events.map((e) => ({
      id: e.id,
      type: e.type as LeadEventType,
      body: e.body,
      actor: e.actorId
        ? { id: e.actorId, name: e.actorName ?? "Deleted user" }
        : null,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

/** Status workflow new → contacted → qualified → won | lost | spam, and assignee. */
export async function updateLead(
  actor: Actor,
  id: string,
  input: UpdateLeadInput
): Promise<LeadDto> {
  assertCan(actor, { lead: ["update"] })
  await getDb().transaction(async (tx) => {
    const row = await repo.lockLeadRow(tx, id)
    if (!row) throw notFound("Lead")
    const patch: { status?: LeadStatus; assigneeId?: string | null } = {}
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    const events: { type: LeadEventType; body: string }[] = []
    if (input.status !== undefined && input.status !== row.status) {
      patch.status = input.status
      diff.status = { from: row.status, to: input.status }
      events.push({
        type: "status",
        body: `${LEAD_STATUS_LABELS[row.status]} → ${LEAD_STATUS_LABELS[input.status]}`,
      })
    }
    if (input.assigneeId !== undefined && input.assigneeId !== row.assigneeId) {
      let name: string | null = null
      if (input.assigneeId) {
        const user = await repo.findStaffUser(tx, input.assigneeId)
        if (!user || !canWorkLeads(user.role, user.banned))
          throw new AppError("VALIDATION_FAILED", "Invalid input", {
            fieldErrors: {
              assigneeId: ["Choose someone who can work on leads"],
            },
          })
        name = user.name
      }
      patch.assigneeId = input.assigneeId
      diff.assigneeId = { from: row.assigneeId, to: input.assigneeId }
      events.push({
        type: "assigned",
        body: name ? `Assigned to ${name}` : "Unassigned",
      })
    }
    if (events.length === 0) return
    await repo.updateLeadRow(tx, id, patch)
    for (const event of events)
      await repo.insertLeadEvent(tx, {
        leadId: id,
        ...event,
        actorId: actor.userId,
      })
    await writeAudit(tx, actor, {
      action: "lead.updated",
      entityType: "lead",
      entityId: id,
      diff,
    })
  })
  return getLead(actor, id)
}

export async function addLeadNote(
  actor: Actor,
  id: string,
  input: { body: string }
): Promise<LeadDto> {
  assertCan(actor, { lead: ["update"] })
  await getDb().transaction(async (tx) => {
    if (!(await repo.lockLeadRow(tx, id))) throw notFound("Lead")
    await repo.insertLeadEvent(tx, {
      leadId: id,
      type: "note",
      body: input.body,
      actorId: actor.userId,
    })
    await writeAudit(tx, actor, {
      action: "lead.note_added",
      entityType: "lead",
      entityId: id,
    })
  })
  return getLead(actor, id)
}

/** GDPR erasure: the lead and its events (cascade). The audit row keeps no personal data. */
export async function deleteLead(
  actor: Actor,
  id: string
): Promise<{ ok: true }> {
  assertCan(actor, { lead: ["delete"] })
  await getDb().transaction(async (tx) => {
    if (!(await repo.deleteLeadRow(tx, id))) throw notFound("Lead")
    await writeAudit(tx, actor, {
      action: "lead.deleted",
      entityType: "lead",
      entityId: id,
    })
  })
  return { ok: true }
}

const NOTE_ID_CHUNK = 1000
/** Per lead in the Notes column: newest notes only, bounded size. */
export const EXPORT_NOTES_MAX = 20
export const EXPORT_NOTES_MAX_CHARS = 20_000

/** Newest notes (oldest dropped first) within both caps, plus a tail line. */
function notesCell(lines: readonly string[]): string {
  let kept = lines.slice(-EXPORT_NOTES_MAX)
  while (kept.length > 0 && kept.join("\n").length > EXPORT_NOTES_MAX_CHARS)
    kept = kept.slice(1)
  const dropped = lines.length - kept.length
  if (dropped === 0) return kept.join("\n")
  return [
    ...kept,
    `… (${dropped} more note${dropped === 1 ? "" : "s"} not exported)`,
  ].join("\n")
}

/**
 * CSV export (RFC 4180, formula-guarded); `email` serves subject-access
 * requests. More than `limit` (LEAD_EXPORT_LIMIT) matches → 422 instead of
 * a silently truncated file. Never includes ip_hash.
 */
export async function exportLeads(
  actor: Actor,
  query: LeadExportQuery,
  now: Date = new Date(),
  { limit = LEAD_EXPORT_LIMIT }: { limit?: number } = {}
): Promise<{ csv: string; filename: string; count: number }> {
  assertCan(actor, { lead: ["export"] })
  const db = getDb()
  const rows = await repo.exportLeadRows(
    db,
    filtersFrom(actor, query),
    limit + 1
  )
  if (rows.length > limit)
    throw new AppError(
      "VALIDATION_FAILED",
      `More than ${limit.toLocaleString("en-IE")} enquiries match. Narrow the filters to export.`
    )
  const notes = new Map<string, string[]>()
  // Chunked: one bind parameter per id, Postgres allows 65,535 per query.
  for (let i = 0; i < rows.length; i += NOTE_ID_CHUNK) {
    const ids = rows.slice(i, i + NOTE_ID_CHUNK).map((r) => r.id)
    for (const note of await repo.listNoteRows(db, ids)) {
      const line = `${note.createdAt.toISOString()} ${note.actorName ?? "Deleted user"}: ${note.body ?? ""}`
      const list = notes.get(note.leadId)
      if (list) list.push(line)
      else notes.set(note.leadId, [line])
    }
  }
  const csv =
    CSV_BOM +
    toCsv(
      LEAD_CSV_HEADER,
      rows.map((r) => [
        r.createdAt.toISOString(),
        LEAD_STATUS_LABELS[r.status],
        r.name,
        r.email,
        r.phone,
        r.company,
        r.service,
        r.message,
        r.consent ? "yes" : "no",
        r.sourcePage,
        r.assigneeId ? (r.assigneeName ?? "Deleted user") : null,
        notesCell(notes.get(r.id) ?? []),
        r.id,
      ])
    )
  await writeAudit(db, actor, {
    action: "lead.exported",
    entityType: "lead",
    diff: {
      count: rows.length,
      filters: Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key]) => key),
    },
  })
  return { csv, filename: `leads-${isoDate(now)}.csv`, count: rows.length }
}

export async function listAssignees(
  actor: Actor
): Promise<{ items: LeadAssignee[] }> {
  assertCan(actor, { lead: ["read"] })
  const rows = await repo.listStaffUsers(getDb())
  return {
    items: rows
      .filter((u) => canWorkLeads(u.role, u.banned))
      .map((u) => ({ id: u.id, name: u.name, email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/** Sidebar badge: unassigned new leads. */
export async function leadBadge(actor: Actor): Promise<LeadBadge> {
  assertCan(actor, { lead: ["read"] })
  return { newLeads: await repo.countUnassignedNewLeads(getDb()) }
}

/** `months` calendar months before `now` (UTC), day clamped to the month's end. */
export function retentionCutoff(now: Date, months: number): Date {
  const day = now.getUTCDate()
  const target = new Date(now.getTime())
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() - months)
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

/**
 * Daily retention purge (spec §9): leads older than
 * settings.leads.retentionMonths, plus expired public rate-limit windows.
 * Audits counts only (no lead data); nothing is cached, so no tags.
 */
export async function purgeExpiredLeads(now: Date = new Date()): Promise<{
  deleted: number
  cutoff: Date | null
  rateLimitsCleared: number
}> {
  const db = getDb()
  const rateLimitsCleared = await deleteExpiredRateLimits(db, now)
  const config = await readPublishedSettings("leads", db)
  if (!config) return { deleted: 0, cutoff: null, rateLimitsCleared }
  const cutoff = retentionCutoff(now, config.retentionMonths)
  const deleted = await db.transaction(async (tx) => {
    const count = await repo.deleteLeadsCreatedBefore(tx, cutoff)
    if (count > 0)
      await writeAudit(tx, null, {
        action: "lead.purged",
        entityType: "lead",
        diff: { count, cutoff: cutoff.toISOString() },
      })
    return count
  })
  return { deleted, cutoff, rateLimitsCleared }
}
