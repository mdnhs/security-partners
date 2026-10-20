import "server-only"

import { randomBytes, timingSafeEqual } from "node:crypto"

import { after } from "next/server"
import { createElement } from "react"

import { NewsletterConfirmation } from "@/emails/newsletter-confirmation"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { CSV_BOM, toCsv } from "@/lib/csv"
import { exportPermission } from "@/lib/newsletter/export"
import {
  confirmTokenHash,
  formatUnsubscribeToken,
  newsletterMac,
  UNSUBSCRIBE_MAC_LENGTH,
} from "@/lib/newsletter/tokens"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  SUBSCRIBER_CSV_HEADER,
  type NewsletterSubmission,
  type SubscriberDto,
  type SubscriberListQuery,
} from "@/lib/schemas/api/newsletter"
import type { NewsletterSettings } from "@/lib/schemas/settings/newsletter"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { deriveKey } from "@/server/lib/crypto"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { hashIp } from "@/server/lib/ip"
import { mailer } from "@/server/lib/mailer"
import { consumeRateLimit } from "@/server/lib/rate-limit"
import { newsletterBlockPublished } from "@/server/modules/builder-pages/queries"
import { assertHuman, honeypotFilled } from "@/server/modules/leads/service"
import { readPublishedSettings } from "@/server/modules/settings/service"

import * as repo from "./repo"

/** Spec §7.4: 5 signups per 10 minutes per IP hash, and the same per address hash. */
export const NEWSLETTER_LIMIT = {
  bucket: "newsletter",
  max: 5,
  windowMs: 600_000,
} as const
export const CONFIRM_TTL_MS = 7 * 86_400_000
/**
 * A pending address is re-mailed at most once per hour (mail-bombing guard);
 * a re-signup inside the window answers the same 201 and the earlier link
 * stays valid.
 */
export const RESEND_COOLDOWN_MS = 3_600_000
/**
 * On top of the cooldown: at most 3 confirmation mails per address per
 * 24 h. Counted only when a mail is actually sent; over the cap the signup
 * answers the same 201, sends nothing and keeps the last link valid.
 */
export const RESEND_DAILY_CAP = {
  bucket: "newsletter-resend",
  max: 3,
  windowMs: 86_400_000,
} as const
/** Per IP on the token endpoints (confirm, unsubscribe): only DB-load hygiene. */
export const NEWSLETTER_TOKEN_LIMIT = {
  bucket: "newsletter-token",
  max: 30,
  windowMs: 600_000,
} as const
const TOKEN_MAX_LENGTH = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DEFAULT_SUBJECT = "Confirm your subscription"
/** Public confirm view; renders a button that POSTs `{ token }` to the API. */
export const CONFIRM_VIEW_PATH = "/newsletter/confirm"

const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"
/** HMAC with the HKDF "newsletter" key; `kind` separates the uses of the key. */
const mac = (kind: "unsubscribe" | "email", value: string) =>
  newsletterMac(deriveKey("newsletter"), kind, value)

/** `<id>.<HMAC-SHA256(deriveKey("newsletter"), id) base64url[:32]>` — never expires. */
export function unsubscribeToken(id: string): string {
  return formatUnsubscribeToken(deriveKey("newsletter"), id)
}

/** The subscriber id when the token's MAC is valid (constant-time compare), else null. */
export function readUnsubscribeToken(token: string): string | null {
  if (typeof token !== "string" || token.length > TOKEN_MAX_LENGTH) return null
  const dot = token.indexOf(".")
  if (dot < 0) return null
  const id = token.slice(0, dot)
  if (!UUID.test(id)) return null
  const given = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(
    mac("unsubscribe", id).slice(0, UNSUBSCRIBE_MAC_LENGTH)
  )
  if (given.length !== expected.length) return null
  return timingSafeEqual(given, expected) ? id : null
}

/** Rate-limit key per address: an HMAC, so the table never holds an email. */
export function emailRateLimitKey(email: string): string {
  return `${NEWSLETTER_LIMIT.bucket}:email:${mac("email", email)}`
}

async function readSettings(): Promise<NewsletterSettings | null> {
  return readPublishedSettings("newsletter")
}

/**
 * Whether the public form may accept signups: a placement is on, or a
 * published builder page shows a newsletter block (D5).
 */
export async function newsletterAcceptsSignups(
  settings?: NewsletterSettings | null
): Promise<boolean> {
  const value = settings === undefined ? await readSettings() : settings
  if (value === null) return false
  return value.placement !== "off" || (await newsletterBlockPublished())
}

/**
 * Runs after the response (next/server `after`) so a new address and a
 * confirmed one answer in the same time. Outside a request scope (scripts)
 * it runs detached, with a warning: on serverless a detached promise can be
 * dropped when the function freezes.
 */
function defer(task: () => Promise<void>): void {
  const run = () =>
    task().catch((err) =>
      console.error(`[newsletter] deferred task failed (${errorName(err)})`)
    )
  try {
    after(run)
  } catch (err) {
    console.warn(
      `[newsletter] after() unavailable (${errorName(err)}); running the mail task detached`
    )
    void run()
  }
}

/** Rolls the signup transaction back: the address hit RESEND_DAILY_CAP. */
class DailyCapReached extends Error {}

/** Per-address 429; carries the window's Retry-After for the route. */
export class NewsletterRateLimitedError extends AppError {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super("RATE_LIMITED", "Too many requests. Try again later.")
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Public signup (spec §7.4). Every valid request answers `{ ok: true }`
 * whether the address is new, pending or confirmed; a confirmed address is
 * never re-mailed. Throws 404 while no placement is on.
 */
export async function subscribe(
  input: NewsletterSubmission,
  ctx: { ip: string | null; now?: Date }
): Promise<{ ok: true }> {
  const now = ctx.now ?? new Date()
  const settings = await readSettings()
  if (!settings || !(await newsletterAcceptsSignups(settings)))
    throw notFound("Page")
  await assertHuman(input.turnstileToken, ctx.ip)
  if (honeypotFilled(input.website)) {
    console.info("[newsletter] honeypot filled; signup dropped")
    return { ok: true }
  }
  const byEmail = await consumeRateLimit(emailRateLimitKey(input.email), {
    ...NEWSLETTER_LIMIT,
    now,
  })
  if (!byEmail.allowed)
    throw new NewsletterRateLimitedError(byEmail.retryAfterSeconds)

  const db = getDb()
  const meta = {
    sourcePath: input.sourcePath ?? "/",
    consentText: [settings.subtitle, settings.button]
      .filter(Boolean)
      .join(" — "),
  }
  if (!settings.doubleOptIn) {
    // Confirmed at once: the IP hash is not kept past confirmation.
    await repo.upsertConfirmed(db, input.email, { ...meta, ipHash: null, now })
    return { ok: true }
  }
  const token = randomBytes(32).toString("base64url")
  // One transaction: over the daily cap the upsert (new token) rolls back
  // with the cap hit, so the last link stays valid and nothing is counted.
  const row = await db
    .transaction(async (tx) => {
      const upserted = await repo.upsertPending(tx, input.email, {
        ...meta,
        ipHash: ctx.ip ? hashIp(ctx.ip) : null,
        tokenHash: confirmTokenHash(token),
        tokenExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
        now,
        resendAfter: new Date(now.getTime() - RESEND_COOLDOWN_MS),
      })
      if (!upserted) return null
      const cap = await consumeRateLimit(
        `${RESEND_DAILY_CAP.bucket}:email:${mac("email", input.email)}`,
        { ...RESEND_DAILY_CAP, now },
        tx
      )
      if (!cap.allowed) throw new DailyCapReached()
      return upserted
    })
    .catch((err: unknown) => {
      if (err instanceof DailyCapReached) return null
      throw err
    })
  if (row) defer(() => sendConfirmation(row.id, input.email, token, settings))
  return { ok: true }
}

async function sendConfirmation(
  id: string,
  to: string,
  token: string,
  settings: NewsletterSettings
): Promise<void> {
  const site = await readPublishedSettings("site")
  const origin = getEnv().BETTER_AUTH_URL
  // The confirm view (D4.2 page): its button POSTs the token, so a mail
  // gateway pre-fetching the link cannot confirm on the person's behalf.
  const confirmUrl = new URL(CONFIRM_VIEW_PATH, origin)
  confirmUrl.searchParams.set("token", token)
  const unsubscribeUrl = new URL("/newsletter/unsubscribe", origin)
  unsubscribeUrl.searchParams.set("token", unsubscribeToken(id))
  const subject = settings.confirmationEmail.subject || DEFAULT_SUBJECT
  // Never throws; with SMTP unset it logs the template and recipient domain only.
  await mailer.send({
    to,
    template: "newsletter-confirmation",
    subject,
    react: createElement(NewsletterConfirmation, {
      subject,
      body: settings.confirmationEmail.body,
      confirmUrl: confirmUrl.toString(),
      unsubscribeUrl: unsubscribeUrl.toString(),
      siteName: site?.name ?? "Security Partners",
    }),
  })
}

/**
 * Single use, 7-day TTL. Only the sha256 is stored, so the lookup leaks
 * nothing. State-changing: only ever called from the POST route.
 */
export async function confirm(
  token: string,
  now: Date = new Date()
): Promise<boolean> {
  if (!token || token.length > TOKEN_MAX_LENGTH) return false
  return repo.confirmByTokenHash(getDb(), confirmTokenHash(token), now)
}

/** Always resolves the same way: a forged or unknown token looks like a real one. */
export async function unsubscribe(
  token: string,
  now: Date = new Date()
): Promise<void> {
  const id = readUnsubscribeToken(token)
  if (!id) return
  await repo.markUnsubscribed(getDb(), id, now)
}

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: repo.SubscriberRow): SubscriberDto {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    sourcePath: row.sourcePath,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
  }
}

export async function listSubscribers(
  actor: Actor,
  q: SubscriberListQuery
): Promise<Paginated<SubscriberDto>> {
  assertCan(actor, { newsletter: ["read"] })
  const { rows, total } = await repo.listSubscriberRows(getDb(), {
    filters: { status: q.status, q: q.q || undefined },
    page: q.page,
    pageSize: q.pageSize,
  })
  return {
    items: rows.map(toDto),
    page: q.page,
    pageSize: q.pageSize,
    total,
  }
}

export { exportPermission }

/** CSV (formula-guarded, BOM for Excel). Audits the count only, never addresses. */
export async function exportSubscribers(
  actor: Actor,
  status: "all" | "confirmed"
): Promise<string> {
  assertCan(actor, exportPermission(status))
  const db = getDb()
  const rows = await repo.exportSubscriberRows(db, status)
  const iso = (d: Date | null) => d?.toISOString() ?? null
  const csv =
    CSV_BOM +
    toCsv(
      SUBSCRIBER_CSV_HEADER,
      rows.map((r) => [
        r.email,
        r.status,
        r.sourcePath,
        r.consentText,
        iso(r.createdAt),
        iso(r.confirmedAt),
        iso(r.unsubscribedAt),
      ])
    )
  await writeAudit(db, actor, {
    action: "newsletter.exported",
    entityType: "newsletter",
    diff: { count: rows.length, status },
  })
  return csv
}

export async function deleteSubscriber(
  actor: Actor,
  id: string
): Promise<{ ok: true }> {
  assertCan(actor, { newsletter: ["delete"] })
  await getDb().transaction(async (tx) => {
    if (!(await repo.deleteSubscriberRow(tx, id))) throw notFound("Subscriber")
    await writeAudit(tx, actor, {
      action: "newsletter.deleted",
      entityType: "newsletter",
      entityId: id,
    })
  })
  return { ok: true }
}

/**
 * Retention: pending rows older than settings.newsletter.pendingDays,
 * measured from created_at (a row re-pended after an unsubscribe counts from
 * its latest link instead). Confirmed and unsubscribed rows are never purged
 * here. Null while settings.newsletter is unpublished (nothing purged).
 * Run daily by the purge-newsletter job.
 */
export async function purgeStalePending(
  now: Date = new Date()
): Promise<number | null> {
  const db = getDb()
  const settings = await readPublishedSettings("newsletter", db)
  if (!settings) return null
  const cutoff = new Date(now.getTime() - settings.pendingDays * 86_400_000)
  return db.transaction(async (tx) => {
    const count = await repo.deletePendingBefore(tx, cutoff, CONFIRM_TTL_MS)
    if (count > 0)
      await writeAudit(tx, null, {
        action: "newsletter.purged",
        entityType: "newsletter",
        diff: { count, cutoff: cutoff.toISOString() },
      })
    return count
  })
}

/** Dashboard KPI: confirmed subscribers, and those confirmed in the last 30 days. */
export async function countSubscribers(
  now: Date = new Date()
): Promise<{ confirmed: number; since30d: number }> {
  return repo.countConfirmed(getDb(), new Date(now.getTime() - 30 * 86_400_000))
}

/**
 * DSAR helper (lead CSV-by-email): needs newsletter:read, like the list.
 * Each lookup is audited (found yes/no, never the address) for the
 * privacy-request trail.
 */
export async function findSubscriberByEmail(
  actor: Actor,
  email: string
): Promise<SubscriberDto | null> {
  assertCan(actor, { newsletter: ["read"] })
  const db = getDb()
  const row = await repo.findByEmail(db, email.trim().toLowerCase())
  await writeAudit(db, actor, {
    action: "newsletter.looked_up",
    entityType: "newsletter",
    entityId: row?.id,
    diff: { found: row !== null },
  })
  return row ? toDto(row) : null
}

/** GDPR erasure by address; audits the count only. */
export async function eraseSubscriberByEmail(
  actor: Actor,
  email: string
): Promise<number> {
  assertCan(actor, { newsletter: ["delete"] })
  return getDb().transaction(async (tx) => {
    const ids = await repo.deleteByEmail(tx, email.trim().toLowerCase())
    for (const id of ids)
      await writeAudit(tx, actor, {
        action: "newsletter.deleted",
        entityType: "newsletter",
        entityId: id,
        diff: { reason: "erasure" },
      })
    return ids.length
  })
}
