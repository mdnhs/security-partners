import type { StatusTone } from "@/components/admin/kit/status-pill"
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/schemas/api/applications"

export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  new: "info",
  reviewing: "neutral",
  shortlisted: "warning",
  interview: "warning",
  offered: "success",
  hired: "success",
  rejected: "danger",
}

export const APPLICATION_STATUS_OPTIONS = APPLICATION_STATUSES.map((value) => ({
  value,
  label: APPLICATION_STATUS_LABELS[value],
}))

export const applicationHref = (id: string) =>
  `/admin/careers/applications/${id}`

export const applicationFileHref = (id: string, kind: "cv" | "psa-card") =>
  `/api/v1/admin/applications/${id}/files/${kind}`
