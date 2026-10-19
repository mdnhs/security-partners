import type { PermissionRequest } from "@/lib/auth/permissions"

export type NewsletterExportStatus = "all" | "confirmed"

/**
 * Who may export which statuses; the API enforces it and the admin UI uses
 * it to pick the export link. "confirmed" needs newsletter:export (owner,
 * admin, marketer). "all" also hands out pending (never consented) and
 * unsubscribed (opted out) addresses, which must never be imported into a
 * mailing tool, so it additionally needs newsletter:delete — the
 * owner/admin-only grant over the whole list.
 */
export function exportPermission(
  status: NewsletterExportStatus
): PermissionRequest {
  return status === "all"
    ? { newsletter: ["export", "delete"] }
    : { newsletter: ["export"] }
}
