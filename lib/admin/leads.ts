import type { StatusTone } from "@/components/admin/kit/status-pill"
import {
  LEAD_STATUS_FILTERS,
  type LeadStatus,
  type LeadStatusFilter,
} from "@/lib/schemas/api/leads"

/**
 * The StatusPill tone of each lead status (Phase 4b kit: soft fill, strong
 * text); the same tones as the kit's STATUS_TONES (dashboard pills).
 */
export const LEAD_STATUS_BADGE: Record<LeadStatus, StatusTone> = {
  new: "info",
  contacted: "warning",
  qualified: "warning",
  won: "success",
  lost: "danger",
  spam: "danger",
}

/** Inbox filters from the URL; "" = off. Assignee: "me" | "none" | a user id. */
export type LeadInboxFilters = {
  status: "" | LeadStatusFilter
  assignee: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A URL-supplied lead id (`?lead=`) is only used when it is a UUID, so it
 * never reaches the Hono client's `param` as a path segment (SEC1).
 * integration: main has the shared `isUuid` in lib/ids.ts.
 */
export function isLeadId(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value)
}

/** ?status= & ?assignee= (dashboard and email links); unknown values → "". */
export function parseLeadFilters(params: URLSearchParams): LeadInboxFilters {
  const status = params.get("status") ?? ""
  const assignee = params.get("assignee") ?? ""
  return {
    status: (LEAD_STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as LeadStatusFilter)
      : "",
    assignee:
      assignee === "me" || assignee === "none" || UUID.test(assignee)
        ? assignee
        : "",
  }
}

/** The API query for the filters, empty ones left out. */
export function leadFilterQuery(f: LeadInboxFilters): {
  status?: string
  assignee?: string
} {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.assignee ? { assignee: f.assignee } : {}),
  }
}

/**
 * The CSV download for these filters and search (`email`: one person's
 * data, GDPR subject access).
 */
export function leadExportHref(f: {
  status?: string
  assignee?: string
  q?: string
  email?: string
}): string {
  const params = new URLSearchParams()
  for (const key of ["status", "assignee", "q", "email"] as const)
    if (f[key]) params.set(key, f[key])
  const query = params.toString()
  return `/api/v1/admin/leads/export.csv${query ? `?${query}` : ""}`
}
