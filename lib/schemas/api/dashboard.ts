import type { QaFinding } from "@/lib/content/qa"

/** GET /api/v1/admin/dashboard (spec §8.1). null = the actor may not see it. */
export type DashboardDto = {
  kpis: {
    /**
     * Non-spam enquiries in the last 30 Irish calendar days (today so far
     * included), and in the 30 days before that up to the same Irish
     * wall-clock time on its last day (the delta's baseline: equal spans).
     */
    leads30d: { value: number; previous: number } | null
    openLeads: number | null
    published: { pages: number; services: number; articles: number } | null
    inReview: number | null
    /** SEO health score, 0–100 (seo:read; the SEO screen's figure). */
    seoScore: number | null
  }
  /**
   * Non-spam enquiries per Irish day, this week (Monday → Sunday) beside
   * the same weekday last week (lead:read). `current` is this week so far,
   * `previous` all of last week, and `previousToDate` last week up to the
   * same weekday and Irish wall-clock time as now: the fair comparison
   * for `current`.
   */
  enquiriesWeek: {
    days: { key: string; label: string; current: number; previous: number }[]
    current: number
    previous: number
    previousToDate: number
  } | null
  /**
   * Published records by their SEO checks (seo:read): `missing` when the
   * meta description or image alt text fails, `needsWork` for any other
   * failing check, `complete` when every check passes.
   */
  contentHealth: { complete: number; needsWork: number; missing: number } | null
  /**
   * Placeholder copy and unfinished legal pages (settings:read or
   * page:read), scanning only what the actor may read.
   */
  qa: QaFinding[] | null
  nextUp: NextUpItem[]
}

export type NextUpItem = {
  id:
    | "smtp"
    | "r2"
    | "ai"
    | "two-factor"
    | "review"
    | "unassigned-leads"
    | "reply"
    | "failed-jobs"
    | "turnstile-unreadable"
  title: string
  description: string
  href: string
  done: boolean
}

/**
 * The topbar bell (final review I6): the open "Next up" items that need
 * someone now, each only for those allowed to act on it.
 */
export type ShellNotification = {
  id: "new-leads" | "failed-jobs" | "turnstile-unreadable"
  title: string
  description: string
  href: string
}
