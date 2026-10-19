import { formatDateTime } from "@/lib/format"
import { CONTENT_STATUSES, type ContentStatus } from "@/lib/schemas/api/content"

export type StatusBadge = {
  text: string
  variant: "default" | "secondary" | "outline"
}

/** Badge for an article: its workflow step, or whether the site is up to date. */
export function articleStatusLabel(article: {
  status: ContentStatus
  live: boolean
  dirty: boolean
  scheduledAt: string | null
}): StatusBadge {
  if (article.status === "scheduled")
    return {
      text: article.scheduledAt
        ? `Scheduled · ${formatDateTime(article.scheduledAt)}`
        : "Scheduled",
      variant: "secondary",
    }
  if (article.status === "in_review")
    return { text: "In review", variant: "secondary" }
  if (!article.live) return { text: "Draft", variant: "outline" }
  if (article.dirty)
    return { text: "Unpublished changes", variant: "secondary" }
  return { text: "Published", variant: "default" }
}

/** The list's status buttons ("In review" reads "Review queue" for publishers). */
export const ARTICLE_STATUS_FILTERS: readonly {
  value: ContentStatus | null
  label: string
}[] = [
  { value: null, label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
]

export function parseStatusParam(value: string | null): ContentStatus | null {
  return (CONTENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as ContentStatus)
    : null
}

export function articleListHref(status: ContentStatus | null): string {
  return status ? `/admin/insights?status=${status}` : "/admin/insights"
}
