import "server-only"

import { readableSettingsKeys } from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { sameTimeOn, startOfDay, weekWindow } from "@/lib/dashboard/week"
import type {
  DashboardDto,
  NextUpItem,
  ShellNotification,
} from "@/lib/schemas/api/dashboard"
import type { SeoHealthDto } from "@/lib/schemas/api/seo"
import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { getAiStatus } from "@/server/modules/ai/service"
import { integrationReadState } from "@/server/modules/integrations/service"
import { cachedQa, cachedSeoHealth } from "./content-review"
import { trendDays } from "./days"
import * as repo from "./repo"

export { trendDays }

/** A lead's name in a Next-up title: one line, at most this many characters. */
const NAME_MAX = 60

/**
 * Published records by their SEO checks: a failing meta description or
 * image alt text is `missing`, any other failure `needsWork`.
 */
export function contentHealthOf(
  health: Pick<SeoHealthDto, "entities">
): NonNullable<DashboardDto["contentHealth"]> {
  const out = { complete: 0, needsWork: 0, missing: 0 }
  for (const entity of health.entities) {
    if (!entity.published) continue
    const failed = entity.results.filter((r) => !r.ok)
    if (failed.some((r) => r.id === "description" || r.id === "alt-text"))
      out.missing++
    else if (failed.length) out.needsWork++
    else out.complete++
  }
  return out
}

/**
 * A dashboard part that scans content (SEO health, QA), or null when it
 * can't be computed (e.g. a settings row that no longer parses): the rest
 * of the dashboard still loads. Logs the part, the error's name and a
 * clipped message (no request data reaches these errors).
 */
async function orNull<T>(
  part: string,
  read: () => Promise<T>
): Promise<T | null> {
  try {
    return await read()
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message.replace(/\s+/g, " ").slice(0, 200)}`
        : typeof error
    console.error(`[dashboard] ${part} unavailable, part hidden (${detail})`)
    return null
  }
}

/**
 * Content QA over what the actor may read: the public settings they can
 * open, pages and builder pages (page:read) and services (service:read).
 * Null without settings:read and page:read. The scan itself is cached per
 * scope (content-review.ts).
 */
async function contentQa(
  actor: Actor,
  can: (req: PermissionRequest) => boolean
): Promise<DashboardDto["qa"]> {
  const canSettings = can({ settings: ["read"] })
  const canPages = can({ page: ["read"] })
  if (!canSettings && !canPages) return null
  const publicKeys = new Set<string>(PUBLIC_SETTINGS_KEYS)
  return cachedQa({
    pages: canPages,
    services: can({ service: ["read"] }),
    settingsKeys: canSettings
      ? readableSettingsKeys(actor.roles).filter((key) => publicKeys.has(key))
      : [],
  })
}

/**
 * KPIs with their baselines, this week vs last week, content health and
 * QA, and the "Next up" checklist (spec §8.1, MK parity D3.5), each part
 * only for actors allowed to see it (null otherwise).
 */
export async function getDashboard(
  actor: Actor,
  now = new Date(),
  /** qa: false skips the content QA scan (the assistant's dashboard tool). */
  options: { qa?: boolean } = {}
): Promise<DashboardDto> {
  const db = getDb()
  const can = (req: PermissionRequest) => hasPermission(actor.roles, req)
  const canLeads = can({ lead: ["read"] })
  const canContent =
    can({ page: ["read"] }) ||
    can({ service: ["read"] }) ||
    can({ article: ["read"] })
  const canArticles = can({ article: ["read"] })
  const canSeo = can({ seo: ["read"] })
  const isOwnerOrAdmin =
    actor.roles.includes("owner") || actor.roles.includes("admin")
  // The 30-day KPI is calendar-aligned: the last 30 Irish days (today so
  // far), against the 30 before them cut at the same wall-clock time on
  // their last day, so both sides span the same time (review M6).
  const previousDays = trendDays(now, 60).slice(0, 30)
  const firstPreviousDay = previousDays[0]!
  const lastPreviousDay = previousDays.at(-1)!
  const [firstKpiDay] = trendDays(now, 30)
  const week = weekWindow(now)

  const [
    leads30d,
    leadsPrevious30d,
    openLeads,
    perDay,
    weekPreviousToDate,
    oldestNew,
    published,
    inReview,
    unassigned,
    configured,
    twoFactor,
    jobProblems,
    turnstile,
    ai,
    seoHealth,
    qa,
  ] = await Promise.all([
    canLeads ? repo.countLeadsFromDay(db, firstKpiDay!) : null,
    canLeads
      ? repo.countLeadsBetween(
          db,
          startOfDay(firstPreviousDay),
          sameTimeOn(now, lastPreviousDay)
        )
      : null,
    canLeads ? repo.countOpenLeads(db) : null,
    canLeads ? repo.leadsPerDay(db, week.previousStart, week.end) : null,
    canLeads
      ? repo.countLeadsBetween(db, week.previousStart, week.previousCut)
      : null,
    canLeads ? repo.oldestNewLead(db) : null,
    canContent ? repo.publishedCounts(db) : null,
    canArticles ? repo.countArticlesInReview(db) : null,
    can({ lead: ["update"] }) ? repo.countUnassignedNewLeads(db) : null,
    can({ integration: ["read"] })
      ? repo.existingSettingsKeys(db, ["integrations.smtp", "integrations.r2"])
      : null,
    isOwnerOrAdmin ? repo.twoFactorEnabled(db, actor.userId) : null,
    can({ integration: ["read"] }) ? repo.listJobProblems(db) : null,
    can({ integration: ["read"] })
      ? integrationReadState("integrations.turnstile", db)
      : null,
    can({ integration: ["update"] }) ? getAiStatus(actor) : null,
    canSeo ? orNull("SEO health", cachedSeoHealth) : null,
    options.qa === false
      ? null
      : orNull("Content QA", () => contentQa(actor, can)),
  ])

  const byDay = new Map((perDay ?? []).map((row) => [row.date, row.n]))
  const weekDays = week.days.map((day, i) => ({
    key: day.key,
    label: day.label,
    current: byDay.get(day.key) ?? 0,
    previous: byDay.get(week.previousDays[i]!.key) ?? 0,
  }))
  const enquiriesWeek: DashboardDto["enquiriesWeek"] = perDay
    ? {
        days: weekDays,
        current: weekDays.reduce((n, day) => n + day.current, 0),
        previous: weekDays.reduce((n, day) => n + day.previous, 0),
        previousToDate: weekPreviousToDate ?? 0,
      }
    : null

  const nextUp: NextUpItem[] = []
  // First, so it is the headline: the public form takes enquiries without
  // the spam check while this lasts (fail-open by ruling, leads service).
  if (turnstile === "unreadable")
    nextUp.push({
      id: "turnstile-unreadable",
      title: "Spam protection is off",
      description:
        "Turnstile settings can't be read — re-enter the keys in Integrations.",
      href: "/admin/settings/integrations/turnstile",
      done: false,
    })
  if (configured) {
    // Settings ▸ Integrations (Phase 6 Task 2).
    nextUp.push({
      id: "smtp",
      title: "Set up email (SMTP)",
      description:
        "Needed for invitations, password resets and enquiry notifications. Until then, links are shown here to copy.",
      href: "/admin/settings/integrations/smtp",
      done: configured.has("integrations.smtp"),
    })
    nextUp.push({
      id: "r2",
      title: "Set up media storage (Cloudflare R2)",
      description:
        "Uploads are kept on the server disk until R2 is configured.",
      href: "/admin/settings/integrations/r2",
      done: configured.has("integrations.r2"),
    })
  }
  // Managers only, while the assistant is not on (MK parity C7). A role
  // left out of its allow-list on purpose is not asked to turn it on.
  if (ai && (ai.reason === "off" || ai.reason === "unconfigured"))
    nextUp.push({
      id: "ai",
      title: "Turn on the AI assistant",
      description: "Draft copy, check SEO and summarise enquiries.",
      href: "/admin/settings/ai-assistant",
      done: false,
    })
  if (twoFactor !== null)
    nextUp.push({
      id: "two-factor",
      title: "Turn on two-factor authentication",
      description:
        "Owners and administrators should protect their sign-in with a code from their phone.",
      href: "/admin/account",
      done: twoFactor,
    })
  if (inReview !== null && can({ article: ["publish"] }))
    nextUp.push({
      id: "review",
      title: inReview
        ? `Review ${inReview} draft${inReview === 1 ? "" : "s"}`
        : "No drafts waiting for review",
      description: "Authors submitted these articles for publishing.",
      href: "/admin/insights?status=in_review",
      done: inReview === 0,
    })
  if (unassigned !== null)
    nextUp.push({
      id: "unassigned-leads",
      title: unassigned
        ? `Assign ${unassigned} new enquir${unassigned === 1 ? "y" : "ies"}`
        : "Every new enquiry has an owner",
      description: "New enquiries nobody has picked up yet.",
      href: "/admin/leads?status=new&assignee=none",
      done: unassigned === 0,
    })
  // Lead readers: open the oldest enquiry still waiting in its drawer.
  if (oldestNew) {
    const name = oldestNew.name.replace(/\s+/g, " ").trim()
    nextUp.push({
      id: "reply",
      title: name
        ? `Reply to ${name.length > NAME_MAX ? `${name.slice(0, NAME_MAX - 1)}…` : name}`
        : "Reply to the oldest new enquiry",
      description: "The oldest enquiry still marked New.",
      href: `/admin/leads?lead=${oldestNew.id}`,
      done: false,
    })
  }
  if (jobProblems && jobProblems.length > 0)
    nextUp.push({
      id: "failed-jobs",
      title: "Background jobs need attention",
      description: jobProblems
        .map((job) => `${job.name}: ${job.lastError.slice(0, 160)}`)
        .join(" · "),
      href: "/admin/settings/integrations",
      done: false,
    })

  return {
    kpis: {
      leads30d:
        leads30d === null
          ? null
          : { value: leads30d, previous: leadsPrevious30d ?? 0 },
      openLeads,
      published,
      inReview,
      seoScore: seoHealth ? seoHealth.score : null,
    },
    enquiriesWeek,
    contentHealth: seoHealth ? contentHealthOf(seoHealth) : null,
    qa,
    nextUp,
  }
}

/**
 * The topbar bell (final review I6), from data the panel already keeps (no
 * table of its own): unassigned new leads (lead:read; the count the sidebar
 * badge shows, passed in), and for integration:read the spam-protection
 * warning and failed background jobs, as on the dashboard's "Next up".
 */
export async function getShellNotifications(
  actor: Actor,
  newLeads: number | null
): Promise<ShellNotification[]> {
  const db = getDb()
  const canIntegrations = hasPermission(actor.roles, { integration: ["read"] })
  const [jobProblems, turnstile] = await Promise.all([
    canIntegrations ? repo.listJobProblems(db) : null,
    canIntegrations ? integrationReadState("integrations.turnstile", db) : null,
  ])
  const items: ShellNotification[] = []
  if (turnstile === "unreadable")
    items.push({
      id: "turnstile-unreadable",
      title: "Spam protection is off",
      description:
        "Turnstile settings can't be read — re-enter the keys in Integrations.",
      href: "/admin/settings/integrations/turnstile",
    })
  if (newLeads && hasPermission(actor.roles, { lead: ["read"] }))
    items.push({
      id: "new-leads",
      title: `${newLeads} new enquir${newLeads === 1 ? "y" : "ies"}`,
      description: "Nobody has picked them up yet.",
      href: "/admin/leads?status=new&assignee=none",
    })
  if (jobProblems && jobProblems.length > 0)
    items.push({
      id: "failed-jobs",
      title: "Background jobs need attention",
      description: jobProblems.map((job) => job.name).join(", "),
      href: "/admin/settings/integrations",
    })
  return items
}
