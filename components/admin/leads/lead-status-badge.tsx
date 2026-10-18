import { StatusPill } from "@/components/admin/kit/status-pill"
import { LEAD_STATUS_BADGE } from "@/lib/admin/leads"
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/schemas/api/leads"

/** New / Contacted / Qualified / Won / Lost / Spam as a status pill. */
export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <StatusPill tone={LEAD_STATUS_BADGE[status]}>
      {LEAD_STATUS_LABELS[status]}
    </StatusPill>
  )
}
