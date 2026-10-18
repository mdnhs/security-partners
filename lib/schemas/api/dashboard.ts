/** GET /api/v1/admin/dashboard (spec §8.1). null = the actor may not see it. */
export type DashboardDto = {
  kpis: {
    leads30d: number | null
    openLeads: number | null
    published: { pages: number; services: number; articles: number } | null
    inReview: number | null
  }
  /** One entry per day (Europe/Dublin), oldest first, 90 days ending today. */
  leadsTrend: { date: string; count: number }[] | null
  nextUp: NextUpItem[]
}

export type NextUpItem = {
  id:
    | "smtp"
    | "r2"
    | "two-factor"
    | "review"
    | "unassigned-leads"
    | "failed-jobs"
    | "turnstile-unreadable"
  title: string
  description: string
  href: string
  done: boolean
}

export const TREND_DAYS = 90
