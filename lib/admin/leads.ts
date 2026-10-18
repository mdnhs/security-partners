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

/** The CSV download for these filters (`email`: one person's data, GDPR). */
export function leadExportHref(f: {
  status?: string
  assignee?: string
  email?: string
}): string {
  const params = new URLSearchParams()
  for (const key of ["status", "assignee", "email"] as const)
    if (f[key]) params.set(key, f[key])
  const query = params.toString()
  return `/api/v1/admin/leads/export.csv${query ? `?${query}` : ""}`
}
