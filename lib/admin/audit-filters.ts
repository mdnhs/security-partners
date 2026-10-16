import { SITE_TIME_ZONE } from "@/lib/format"

/** Audit log filters as the screen holds them ("" = not filtered). */
export type AuditFilters = {
  /** User id. */
  actor: string
  /** Exact action, e.g. "user.invite". */
  action: string
  /** Exact entity type, e.g. "user". */
  entityType: string
  /** Irish calendar days "YYYY-MM-DD" (inclusive). */
  from: string
  to: string
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  actor: "",
  action: "",
  entityType: "",
  from: "",
  to: "",
}

/** Suggestions for the action filter (the API filters on the exact text). */
export const AUDIT_ACTION_SUGGESTIONS = [
  "auth.sign_in",
  "auth.sign_in_failed",
  "auth.sign_out",
  "auth.password_reset",
  "auth.2fa_enable",
  "user.invite",
  "user.update",
  "user.roles_change",
  "user.ban",
  "user.unban",
  "user.sessions_revoke",
  "user.password_link",
  "user.impersonate_start",
  "user.impersonate_stop",
  "page.draft_saved",
  "page.published",
  "page.restored",
  "settings.draft_saved",
  "settings.published",
  "settings.restored",
  "service.created",
  "service.draft_saved",
  "service.published",
  "service.restored",
  "service.slug_changed",
  "service.deleted",
] as const

/** Suggestions for the entity filter (Phases 2–4 write these types). */
export const AUDIT_ENTITY_TYPES = [
  "user",
  "page",
  "settings",
  "service",
  "team",
  "client",
  "groupCompany",
  "category",
] as const

const DAY = /^\d{4}-\d{2}-\d{2}$/

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: SITE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/** Irish wall-clock time minus UTC at `instant`, in ms (0 or 3 600 000). */
function dublinOffsetMs(instant: number): number {
  const p = Object.fromEntries(
    wallClock.formatToParts(new Date(instant)).map((x) => [x.type, x.value])
  )
  const wall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  )
  return wall - instant
}

/**
 * The UTC instant of 00:00 Irish time on `day` (+ `addDays`). Ireland is
 * UTC+0 or UTC+1 and never changes clocks at midnight, so one correction
 * from the UTC-midnight guess is exact.
 */
export function dublinMidnightUtc(day: string, addDays = 0): Date {
  const [year, month, date] = day.split("-").map(Number)
  const guess = Date.UTC(year, month - 1, date + addDays)
  return new Date(guess - dublinOffsetMs(guess))
}

/** A complete "YYYY-MM-DD" (a date input can hold a partial value). */
const wholeDay = (value: string) => (DAY.test(value) ? value : undefined)

/** GET /api/v1/admin/audit filter params; days become UTC instants. */
export function auditFilterQuery(filters: AuditFilters): {
  actor?: string
  action?: string
  entityType?: string
  from?: string
  to?: string
} {
  const action = filters.action.trim()
  const entityType = filters.entityType.trim()
  const from = wholeDay(filters.from)
  const to = wholeDay(filters.to)
  return {
    actor: filters.actor || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
    from: from ? dublinMidnightUtc(from).toISOString() : undefined,
    // Inclusive: up to the last millisecond of that Irish day.
    to: to
      ? new Date(dublinMidnightUtc(to, 1).getTime() - 1).toISOString()
      : undefined,
  }
}

export function hasAuditFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some((value) => value.trim() !== "")
}
