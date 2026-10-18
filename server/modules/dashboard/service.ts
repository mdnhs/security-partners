import "server-only"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { isoDate } from "@/lib/format"
import {
  type DashboardDto,
  type NextUpItem,
  TREND_DAYS,
} from "@/lib/schemas/api/dashboard"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"

import * as repo from "./repo"

const DAY = 86_400_000

/** The last `days` calendar dates (Europe/Dublin), oldest first, ending today. */
export function trendDays(now: Date, days = TREND_DAYS): string[] {
  const [y, m, d] = isoDate(now).split("-").map(Number)
  // Noon UTC: one calendar day per step, whatever the DST offset.
  const todayNoon = Date.UTC(y, m - 1, d, 12)
  return Array.from({ length: days }, (_, i) =>
    new Date(todayNoon - (days - 1 - i) * DAY).toISOString().slice(0, 10)
  )
}

/**
 * KPIs, 90-day lead trend and the "Next up" checklist (spec §8.1), each
 * part only for actors allowed to see it (null otherwise).
 */
export async function getDashboard(
  actor: Actor,
  now = new Date()
): Promise<DashboardDto> {
  const db = getDb()
  const can = (req: PermissionRequest) => hasPermission(actor.roles, req)
  const canLeads = can({ lead: ["read"] })
  const canContent =
    can({ page: ["read"] }) ||
    can({ service: ["read"] }) ||
    can({ article: ["read"] })
  const canArticles = can({ article: ["read"] })
  const isOwnerOrAdmin =
    actor.roles.includes("owner") || actor.roles.includes("admin")
  const days = trendDays(now)
  // The 30-day KPI is calendar-aligned like the trend: the last 30 Irish days.
  const [firstKpiDay] = trendDays(now, 30)
  // A day wider than the chart: days outside `days` fall off in the map below.
  const since = new Date(now.getTime() - (TREND_DAYS + 1) * DAY)

  const [
    leads30d,
    openLeads,
    perDay,
    published,
    inReview,
    unassigned,
    configured,
    twoFactor,
  ] = await Promise.all([
    canLeads ? repo.countLeadsFromDay(db, firstKpiDay!) : null,
    canLeads ? repo.countOpenLeads(db) : null,
    canLeads ? repo.leadsPerDay(db, since) : null,
    canContent ? repo.publishedCounts(db) : null,
    canArticles ? repo.countArticlesInReview(db) : null,
    can({ lead: ["update"] }) ? repo.countUnassignedNewLeads(db) : null,
    can({ integration: ["read"] })
      ? repo.existingSettingsKeys(db, ["integrations.smtp", "integrations.r2"])
      : null,
    isOwnerOrAdmin ? repo.twoFactorEnabled(db, actor.userId) : null,
  ])

  const byDay = new Map((perDay ?? []).map((row) => [row.date, row.n]))
  const nextUp: NextUpItem[] = []
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
      href: "/admin/articles?status=in_review",
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

  return {
    kpis: { leads30d, openLeads, published, inReview },
    leadsTrend: perDay
      ? days.map((date) => ({ date, count: byDay.get(date) ?? 0 }))
      : null,
    nextUp,
  }
}
