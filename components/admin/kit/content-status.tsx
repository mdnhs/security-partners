import { StatusPill, type StatusTone } from "./status-pill"

export type ContentState = { published: unknown; dirty: boolean }

/** Draft, Published, or Published + Unpublished changes (JW pages list). */
export function contentStatus(
  record: ContentState
): { label: string; tone: StatusTone }[] {
  // null or undefined: never published.
  if (record.published == null) return [{ label: "Draft", tone: "neutral" }]
  const pills: { label: string; tone: StatusTone }[] = [
    { label: "Published", tone: "success" },
  ]
  if (record.dirty)
    pills.push({ label: "Unpublished changes", tone: "warning" })
  return pills
}

export function ContentStatusPills({ record }: { record: ContentState }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {contentStatus(record).map((pill) => (
        <StatusPill key={pill.label} tone={pill.tone}>
          {pill.label}
        </StatusPill>
      ))}
    </span>
  )
}
